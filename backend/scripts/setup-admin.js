#!/usr/bin/env node
/**
 * Bytezone — vytvorenie admin účtu
 *
 * Spustenie:
 *   npm run setup:admin
 *
 * Predpoklady:
 *   - DB beží (docker compose up -d)
 *   - Migrácie a seedy spustené (npm run migrate && npm run seed)
 */

'use strict';

const path = require('path');
const readline = require('node:readline/promises');
const bcrypt = require('bcryptjs');

// Resolve config + knex z koreňa projektu (script je v backend/scripts/)
const config = require(path.resolve(__dirname, '..', '..', 'config'));
const knexfile = require(path.resolve(__dirname, '..', '..', 'knexfile'));
const knex = require('knex')(knexfile[config.app.env] || knexfile.development);

// =============================================================================
// Prompt helpers
// =============================================================================

async function promptVisible(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

function promptHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;

    if (!stdin.isTTY) {
      // Non-interactive fallback (napr. spustené cez pipe) — viditeľné
      let buf = '';
      stdin.resume();
      stdin.setEncoding('utf8');
      const onData = (chunk) => {
        buf += chunk;
        if (buf.includes('\n')) {
          stdin.removeListener('data', onData);
          stdin.pause();
          resolve(buf.split('\n')[0].trim());
        }
      };
      stdin.on('data', onData);
      return;
    }

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let value = '';
    const onData = (char) => {
      // Ctrl+C
      if (char === '\u0003') {
        process.stdout.write('\n');
        process.exit(1);
      }
      // Enter / EOT
      if (char === '\r' || char === '\n' || char === '\u0004') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        return resolve(value);
      }
      // Backspace
      if (char === '\u007f' || char === '\b') {
        if (value.length > 0) {
          value = value.slice(0, -1);
          process.stdout.write('\b \b');
        }
        return;
      }
      value += char;
      process.stdout.write('*');
    };
    stdin.on('data', onData);
  });
}

// =============================================================================
// Validations
// =============================================================================

function validateNickname(s) {
  if (!s || s.length < 3 || s.length > 64) return 'Nickname musí mať 3–64 znakov.';
  if (!/^[a-zA-Z0-9_-]+$/.test(s))
    return 'Nickname môže obsahovať len písmená, čísla, _ a -';
  return null;
}

function validateEmail(s) {
  if (!s) return null; // voliteľný
  if (s.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return 'Neplatný email.';
  return null;
}

function validatePassword(s) {
  if (!s || s.length < 12) return 'Heslo musí mať aspoň 12 znakov.';
  if (s.length > 200) return 'Heslo je príliš dlhé (max 200).';
  return null;
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log('===========================================');
  console.log('  Bytezone — vytvorenie admin účtu');
  console.log('===========================================\n');

  // 1) test DB
  try {
    await knex.raw('SELECT 1');
  } catch (err) {
    console.error('❌ Nemôžem sa pripojiť k databáze:', err.message);
    console.error('   - Beží docker?  docker compose ps');
    console.error('   - Sú v .env správne credentials?');
    process.exit(1);
  }

  // 2) Existuje už admin?
  const existingAdmin = await knex('users').where('role', 'admin').first();
  if (existingAdmin) {
    console.log(`⚠️  Admin už existuje (nickname: ${existingAdmin.nickname}).`);
    const confirm = await promptVisible('Chceš vytvoriť ďalšieho admina? [y/N]: ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('Zrušené.');
      await knex.destroy();
      process.exit(0);
    }
  }

  // 3) Existujú bezpečnostné otázky?
  const questions = await knex('security_questions')
    .where('is_active', true)
    .orderBy('id');
  if (questions.length === 0) {
    console.error('❌ Tabuľka security_questions je prázdna.');
    console.error('   Spusti najprv:  npm run seed');
    await knex.destroy();
    process.exit(1);
  }

  // 4) Nickname
  let nickname;
  while (true) {
    nickname = await promptVisible('Nickname: ');
    const err = validateNickname(nickname);
    if (err) {
      console.log('  ✗', err);
      continue;
    }
    const taken = await knex('users').where('nickname', nickname).first();
    if (taken) {
      console.log('  ✗ Tento nickname už používa iný účet.');
      continue;
    }
    break;
  }

  // 5) Email (voliteľný)
  let email = null;
  while (true) {
    const input = await promptVisible('Email (voliteľný, Enter = preskočiť): ');
    if (!input) break;
    const err = validateEmail(input);
    if (err) {
      console.log('  ✗', err);
      continue;
    }
    const taken = await knex('users').where('email', input).first();
    if (taken) {
      console.log('  ✗ Tento email už používa iný účet.');
      continue;
    }
    email = input;
    break;
  }

  // 6) Heslo
  let password;
  while (true) {
    password = await promptHidden('Heslo (min 12 znakov): ');
    const err = validatePassword(password);
    if (err) {
      console.log('  ✗', err);
      continue;
    }
    const confirm = await promptHidden('Heslo znova:           ');
    if (confirm !== password) {
      console.log('  ✗ Heslá sa nezhodujú.');
      continue;
    }
    break;
  }

  // 7) Bezpečnostná otázka
  console.log('\nBezpečnostná otázka:');
  questions.forEach((q, i) => console.log(`  ${i + 1}. ${q.text}`));
  console.log(`  ${questions.length + 1}. (vlastná otázka)`);

  let questionId = null;
  let customQuestion = null;
  while (true) {
    const choice = await promptVisible(`Vyber [1-${questions.length + 1}]: `);
    const num = parseInt(choice, 10);
    if (Number.isNaN(num) || num < 1 || num > questions.length + 1) {
      console.log('  ✗ Neplatná voľba.');
      continue;
    }
    if (num === questions.length + 1) {
      while (true) {
        const q = await promptVisible('Tvoja otázka: ');
        if (q.length < 5 || q.length > 255) {
          console.log('  ✗ Otázka musí mať 5–255 znakov.');
          continue;
        }
        customQuestion = q;
        break;
      }
    } else {
      questionId = questions[num - 1].id;
    }
    break;
  }

  // 8) Odpoveď
  let answer;
  while (true) {
    answer = await promptHidden('Odpoveď: ');
    if (!answer || answer.length < 3) {
      console.log('  ✗ Odpoveď musí mať aspoň 3 znaky.');
      continue;
    }
    break;
  }

  // 9) Hashovanie + insert v transakcii
  console.log('\nVytváram účet...');
  const passwordHash = await bcrypt.hash(password, config.security.bcryptCost);
  // odpoveď normalizujeme (lowercase + trim) pred hashovaním, aby sa „pes" a „Pes "
  // pri overovaní vyhodnotili rovnako
  const answerHash = await bcrypt.hash(
    answer.toLowerCase().trim(),
    config.security.bcryptCost
  );

  try {
    await knex.transaction(async (trx) => {
      const insertResult = await trx('users').insert({
        role: 'admin',
        nickname,
        email,
        password_hash: passwordHash,
        gdpr_accepted_at: trx.fn.now(),
      });
      // MySQL/MariaDB vracia [insertId] u bigIncrements
      const userId = Array.isArray(insertResult) ? insertResult[0] : insertResult;

      await trx('user_security_answers').insert({
        user_id: userId,
        question_id: questionId,
        custom_question: customQuestion,
        answer_hash: answerHash,
      });
    });

    console.log('\n✅ Admin účet vytvorený.');
    console.log(`   Nickname: ${nickname}`);
    if (email) console.log(`   Email:    ${email}`);
    console.log('\nPrihlásiť sa budeš môcť na /admin/login po dokončení Fázy 2.\n');
  } catch (err) {
    console.error('\n❌ Chyba pri ukladaní:', err.message);
    process.exit(1);
  } finally {
    await knex.destroy();
  }
}

main().catch((err) => {
  console.error('Neočakávaná chyba:', err);
  process.exit(1);
});

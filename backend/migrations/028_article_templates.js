exports.up = async function (knex) {
  await knex.schema.createTable('article_templates', (t) => {
    t.bigIncrements('id');
    t.string('name', 120).notNullable();
    t.string('icon', 40).defaultTo('bi-file-earmark-text');
    t.enum('type', ['article', 'review']).defaultTo('article');
    t.text('blocks_json').notNullable(); // JSON array of blocks
    t.integer('display_order').unsigned().defaultTo(0);
    t.timestamps(true, true);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('article_templates');
};

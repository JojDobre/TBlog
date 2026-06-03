/**
 * 026_extra_settings.js — Pridáva ďalšie nastavenia webu
 */
exports.up = async function (knex) {
  const exists = async (key) => {
    const row = await knex('settings').where('key', key).first();
    return !!row;
  };

  const add = async (key, value, type, label, group, order) => {
    if (await exists(key)) return;
    await knex('settings').insert({ key, value, value_type: type, label, field_group: group, display_order: order });
  };

  // General
  await add('site_tagline', '', 'string', 'Tagline / slogan', 'general', 25);
  await add('site_footer_text', '© 2026 Bytezone. Všetky práva vyhradené.', 'string', 'Text v pätičke', 'general', 50);
  await add('site_contact_email', '', 'string', 'Kontaktný email', 'general', 60);

  // Appearance
  await add('accent_color', '#60a5fa', 'string', 'Accent farba (hex)', 'appearance', 20);
  await add('custom_css', '', 'string', 'Vlastné CSS (pokročilé)', 'appearance', 90);

  // Social
  await add('social_facebook', '', 'string', 'Facebook URL', 'social', 10);
  await add('social_instagram', '', 'string', 'Instagram URL', 'social', 20);
  await add('social_twitter', '', 'string', 'Twitter / X URL', 'social', 30);
  await add('social_youtube', '', 'string', 'YouTube URL', 'social', 40);
  await add('social_tiktok', '', 'string', 'TikTok URL', 'social', 50);
  await add('social_discord', '', 'string', 'Discord URL', 'social', 60);
  await add('social_github', '', 'string', 'GitHub URL', 'social', 70);

  // SEO
  await add('google_verification', '', 'string', 'Google Search Console meta tag', 'seo', 5);
  await add('ads_head_html', '', 'string', 'Reklamy — HTML do <head> (AdSense)', 'seo', 30);
  await add('ads_article_top', '', 'string', 'Reklama — pred článkom HTML', 'seo', 40);
  await add('ads_article_bottom', '', 'string', 'Reklama — za článkom HTML', 'seo', 50);
};

exports.down = async function (knex) {
  const keys = [
    'site_tagline', 'site_footer_text', 'site_contact_email',
    'accent_color', 'custom_css',
    'social_facebook', 'social_instagram', 'social_twitter', 'social_youtube',
    'social_tiktok', 'social_discord', 'social_github',
    'google_verification', 'ads_head_html', 'ads_article_top', 'ads_article_bottom',
  ];
  await knex('settings').whereIn('key', keys).del();
};

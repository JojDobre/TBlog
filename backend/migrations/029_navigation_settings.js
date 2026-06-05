exports.up = async function (knex) {
  const add = async (key, value, type, label, group, order) => {
    const exists = await knex('settings').where('key', key).first();
    if (!exists)
      await knex('settings').insert({
        key,
        value,
        value_type: type,
        label,
        field_group: group,
        display_order: order,
      });
  };

  const defaultNav = JSON.stringify([
    { href: '/', label: 'Domov' },
    { href: '/recenzie', label: 'Recenzie' },
    { href: '/rebricky', label: 'Rebríčky' },
    { href: '/navody', label: 'Návody' },
    { href: '/kategorie', label: 'Kategórie' },
  ]);

  const defaultFooter = JSON.stringify([
    {
      title: 'Sekcie',
      links: [
        { href: '/recenzie', label: 'Recenzie' },
        { href: '/rebricky', label: 'Rebríčky' },
        { href: '/navody', label: 'Návody' },
        { href: '/porovnania', label: 'Porovnania' },
        { href: '/novinky', label: 'Novinky' },
      ],
    },
    {
      title: 'Kategórie',
      links: [
        { href: '/kategorie/mobily', label: 'Mobily' },
        { href: '/kategorie/notebooky', label: 'Notebooky' },
        { href: '/kategorie/hardware', label: 'Hardware' },
        { href: '/kategorie/software', label: 'Software' },
        { href: '/kategorie/audio', label: 'Audio' },
      ],
    },
    {
      title: 'Magazín',
      links: [
        { href: '/o-nas', label: 'O nás' },
        { href: '/kontakt', label: 'Kontakt' },
        { href: '/ochrana-osobnych-udajov', label: 'Ochrana súkromia' },
      ],
    },
  ]);

  await add('nav_links', defaultNav, 'string', 'Navigácia (JSON)', 'navigation', 10);
  await add('footer_sections', defaultFooter, 'string', 'Footer sekcie (JSON)', 'navigation', 20);
  await add('footer_tagline', 'tech bez kompromisu', 'string', 'Footer tagline', 'navigation', 30);
  await add(
    'footer_description',
    'Nezávislý tech magazín. Recenzie, rebríčky a návody, ktoré píšu ľudia, čo techniku skutočne používajú.',
    'string',
    'Footer popis',
    'navigation',
    40
  );
};

exports.down = async function (knex) {
  await knex('settings')
    .whereIn('key', ['nav_links', 'footer_sections', 'footer_tagline', 'footer_description'])
    .del();
};

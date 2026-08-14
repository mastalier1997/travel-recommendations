/** "Japan – Spring 2026" -> "japan-spring-2026", used as the download filename base. */
export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '') // combining diacritics left behind by NFKD
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'plan'
  );
}

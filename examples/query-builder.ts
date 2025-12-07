/**
 * QueryBuilder Example
 *
 * Demonstrates:
 * - I18nRepository with language context
 * - Standard where(), orderBy() methods auto-translate i18n columns
 * - Language-specific single-value property
 */

import { DataSource, Entity, PrimaryGeneratedColumn, Column, Like } from 'typeorm';
import {
  setI18nConfig,
  I18nColumn,
  I18nValue,
  I18nSubscriber,
  getI18nRepository,
} from '../src';

type Languages = 'en' | 'es' | 'fr';

setI18nConfig({
  languages: ['en', 'es', 'fr'],
  default_language: 'en',
});

@Entity()
class Product {
  @PrimaryGeneratedColumn()
  id!: number;

  @I18nColumn({ type: 'varchar', length: 255 })
  name!: string;

  nameTranslations?: I18nValue<Languages, string>;

  @Column('decimal', { precision: 10, scale: 2 })
  price!: number;
}

async function main() {
  const dataSource = new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    entities: [Product],
    subscribers: [I18nSubscriber],
    synchronize: true,
    logging: false,
  });

  await dataSource.initialize();

  // Seed data
  const repo = getI18nRepository(Product, dataSource);
  const products = [
    { nameTranslations: { en: 'Laptop', es: 'Portátil', fr: 'Ordinateur' }, price: 999 },
    { nameTranslations: { en: 'Mouse', es: 'Ratón', fr: 'Souris' }, price: 29 },
    { nameTranslations: { en: 'Keyboard', es: 'Teclado', fr: 'Clavier' }, price: 79 },
  ];
  for (const data of products) {
    const p = new Product();
    Object.assign(p, data);
    await repo.save(p);
  }

  // Set Spanish context
  repo.setLanguage('es');

  // Standard find() with where clause - auto-translates to name_es
  const spanish = await repo.find({
    where: { name: 'Ratón' } as any,
  });
  console.log('Spanish query result:');
  console.log('  name:', spanish[0]?.name); // "Ratón" (current language)
  console.log('  nameTranslations.en:', spanish[0]?.nameTranslations?.en); // "Mouse"

  // QueryBuilder - standard methods auto-translate
  const results = await repo
    .createQueryBuilder('p')
    .where({ name: Like('%át%') }) // Queries name_es LIKE '%át%'
    .orderBy('p.name', 'ASC') // Orders by name_es
    .getMany();

  console.log('\nQueryBuilder results (Spanish names containing "át"):');
  results.forEach((p) => console.log(' ', p.name));

  // Switch to French
  repo.setLanguage('fr');
  const french = await repo.findOne({
    where: { name: 'Souris' } as any,
  });
  console.log('\nFrench query:');
  console.log('  name:', french?.name); // "Souris"

  // getLanguageColumn for manual queries
  const col = repo.getLanguageColumn('name'); // "name_fr"
  console.log('\nLanguage column:', col);

  await dataSource.destroy();
}

main().catch(console.error);

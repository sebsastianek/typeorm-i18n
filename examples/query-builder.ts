/**
 * QueryBuilder Example
 *
 * Demonstrates:
 * - I18nRepository with language context
 * - whereLanguage, orderByLanguage methods
 * - i18nWhere type helper
 * - Language-specific single-value property
 */

import { DataSource, Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import {
  setI18nConfig,
  I18nColumn,
  I18nValue,
  I18nSubscriber,
  getI18nRepository,
  i18nWhere,
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
  const repo = dataSource.getRepository(Product);
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

  // I18nRepository with language context
  const i18nRepo = getI18nRepository(Product, dataSource);

  // Query with Spanish context
  i18nRepo.setLanguage('es');

  // find() with i18nWhere helper
  const spanish = await i18nRepo.find({
    where: i18nWhere<Product>({ name: 'Ratón' }),
  });
  console.log('Spanish query result:');
  console.log('  name:', spanish[0]?.name); // "Ratón" (current language)
  console.log('  nameTranslations.en:', spanish[0]?.nameTranslations?.en); // "Mouse"

  // QueryBuilder methods
  const results = await i18nRepo
    .createQueryBuilder('p')
    .whereLanguage('name', 'LIKE', '%át%')
    .orderByLanguage('name', 'ASC')
    .getMany();

  console.log('\nQueryBuilder results (Spanish names containing "át"):');
  results.forEach((p) => console.log(' ', p.name));

  // Switch to French
  i18nRepo.setLanguage('fr');
  const french = await i18nRepo.findOne({
    where: i18nWhere<Product>({ name: 'Souris' }),
  });
  console.log('\nFrench query:');
  console.log('  name:', french?.name); // "Souris"

  // getLanguageColumn for manual queries
  const col = i18nRepo.getLanguageColumn('name'); // "name_fr"
  console.log('\nLanguage column:', col);

  await dataSource.destroy();
}

main().catch(console.error);

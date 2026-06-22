import 'reflect-metadata';
import {
  Entity,
  PrimaryGeneratedColumn,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  DataSource,
} from 'typeorm';
import {
  I18nColumn,
  I18nValue,
  getI18nRepository,
  i18nWhere,
} from '../src';
import { createE2EDataSource, closeE2EDataSource } from './db-helper';

type Lang = 'en' | 'es' | 'fr';

@Entity('behavior_articles')
class Article {
  @PrimaryGeneratedColumn() id!: number;

  @I18nColumn({ languages: ['en', 'es', 'fr'], default_language: 'en', type: 'varchar', length: 255, nullable: true })
  title!: string;
  titleTranslations?: I18nValue<Lang, string>;

  @Column({ type: 'real', default: 0 })
  price!: number;
}

@Entity('behavior_items')
class Item {
  @PrimaryColumn() tenantId!: number;
  @PrimaryColumn() itemId!: number;

  @I18nColumn({ languages: ['en', 'es'], default_language: 'en', type: 'varchar', length: 255, nullable: true })
  title!: string;
  titleTranslations?: I18nValue<'en' | 'es', string>;
}

@Entity('behavior_categories')
class Category {
  @PrimaryGeneratedColumn() id!: number;

  @I18nColumn({ languages: ['en', 'es', 'fr'], default_language: 'en', type: 'varchar', length: 255, nullable: true })
  name!: string;
  nameTranslations?: I18nValue<Lang, string>;

  @OneToMany(() => Product, (p) => p.category)
  products?: Product[];
}

@Entity('behavior_products')
class Product {
  @PrimaryGeneratedColumn() id!: number;

  @I18nColumn({ languages: ['en', 'es', 'fr'], default_language: 'en', type: 'varchar', length: 255, nullable: true })
  name!: string;
  nameTranslations?: I18nValue<Lang, string>;

  @Column({ nullable: true })
  categoryId!: number | null;

  @ManyToOne(() => Category, (c) => c.products)
  @JoinColumn({ name: 'categoryId' })
  category?: Category;
}

@Entity('behavior_upsert')
class UpsertRow {
  @PrimaryGeneratedColumn() id!: number;

  @Column({ unique: true })
  sku!: string;

  @I18nColumn({ languages: ['en', 'es', 'fr'], default_language: 'en', type: 'varchar', length: 255, nullable: true })
  title!: string;
  titleTranslations?: I18nValue<Lang, string>;
}

let ds: DataSource;

beforeAll(async () => {
  ds = await createE2EDataSource([Article, Item, Category, Product, UpsertRow], 'sqlite');
});
afterAll(async () => {
  await closeE2EDataSource(ds);
});

describe('language validation', () => {
  it('accepts configured languages (case-insensitive)', () => {
    const repo = getI18nRepository(Article, ds);
    expect(repo.setLanguage('ES').getLanguage()).toBe('es');
    expect(repo.setLanguage('en').getLanguage()).toBe('en');
  });

  it('rejects an unconfigured language', () => {
    const repo = getI18nRepository(Article, ds);
    expect(() => repo.setLanguage('de')).toThrow(/not configured/i);
  });

  it('rejects an injection payload', () => {
    const repo = getI18nRepository(Article, ds);
    expect(() => repo.setLanguage('es); DROP TABLE behavior_articles; --')).toThrow(/invalid language code/i);
    expect(() => repo.setLanguage('es, (SELECT 1)')).toThrow(/invalid language code/i);
  });
});

describe('write path', () => {
  it('routes a single-value save to the current language column', async () => {
    const repo = getI18nRepository(Article, ds);
    repo.setLanguage('es');
    const saved = await repo.save(repo.create({ title: 'Portatil' }));

    const raw = (await ds.query('SELECT title, title_es FROM behavior_articles WHERE id = ?', [saved.id]))[0];
    expect(raw.title).toBeNull();
    expect(raw.title_es).toBe('Portatil');

    const back = await repo.findOne({ where: { id: saved.id } as any });
    expect(back?.title).toBe('Portatil');
    expect(back?.titleTranslations?.es).toBe('Portatil');
  });

  it('persists a single-value edit on a loaded entity (no other column changed)', async () => {
    const repo = getI18nRepository(Article, ds);
    const seed = await repo.save(repo.create({ titleTranslations: { en: 'EN', es: 'ES', fr: 'FR' } }));

    const esRepo = getI18nRepository(Article, ds).setLanguage('es');
    const loaded = await esRepo.findOne({ where: { id: seed.id } as any });
    loaded!.title = 'EditedES';
    await esRepo.save(loaded!);

    const raw = (await ds.query('SELECT title, title_es, title_fr FROM behavior_articles WHERE id = ?', [seed.id]))[0];
    expect(raw.title_es).toBe('EditedES'); // current language updated
    expect(raw.title).toBe('EN'); // other languages untouched
    expect(raw.title_fr).toBe('FR');
  });

  it('does not emit raw language columns in JSON output', async () => {
    const repo = getI18nRepository(Article, ds).setLanguage('es');
    const saved = await repo.save(repo.create({ titleTranslations: { en: 'A', es: 'B', fr: 'C' } }));
    const loaded = await repo.findOne({ where: { id: saved.id } as any });
    expect(Object.keys(loaded as any)).not.toContain('title_es');
    expect(Object.keys(loaded as any)).not.toContain('title_fr');
  });
});

describe('update() translation', () => {
  it('routes a scalar update to the current language column and translates criteria', async () => {
    const repo = getI18nRepository(Article, ds);
    const seed = await repo.save(repo.create({ titleTranslations: { en: 'EN', es: 'ES', fr: 'FR' } }));

    repo.setLanguage('es');
    await repo.update({ title: 'ES' } as any, { title: 'ES2' } as any);

    const raw = (await ds.query('SELECT title, title_es FROM behavior_articles WHERE id = ?', [seed.id]))[0];
    expect(raw.title).toBe('EN');
    expect(raw.title_es).toBe('ES2');
  });

  it('expands a translations object in update values', async () => {
    const repo = getI18nRepository(Article, ds);
    const seed = await repo.save(repo.create({ titleTranslations: { en: 'EN', es: 'ES', fr: 'FR' } }));

    await repo.update({ id: seed.id } as any, { titleTranslations: { en: 'EN2', es: 'ES2' } } as any);
    const raw = (await ds.query('SELECT title, title_es, title_fr FROM behavior_articles WHERE id = ?', [seed.id]))[0];
    expect(raw.title).toBe('EN2');
    expect(raw.title_es).toBe('ES2');
    expect(raw.title_fr).toBe('FR');
  });

  it('lets the translations object win over the scalar in the same update payload', async () => {
    const repo = getI18nRepository(Article, ds);
    const seed = await repo.save(repo.create({ titleTranslations: { en: 'EN', es: 'ES', fr: 'FR' } }));

    await repo.update(
      { id: seed.id } as any,
      { title: 'SCALAR', titleTranslations: { en: 'FROM_OBJECT' } } as any,
    );
    const raw = (await ds.query('SELECT title FROM behavior_articles WHERE id = ?', [seed.id]))[0];
    expect(raw.title).toBe('FROM_OBJECT');
  });
});

describe('translations object precedence', () => {
  it('insert: translations object wins over the scalar', async () => {
    const repo = getI18nRepository(Article, ds);
    const res = await repo.insert({ title: 'SCALAR', titleTranslations: { en: 'FROM_OBJECT', es: 'OBJ_ES' } } as any);
    const id = (res.identifiers[0] as any).id;
    const raw = (await ds.query('SELECT title, title_es FROM behavior_articles WHERE id = ?', [id]))[0];
    expect(raw.title).toBe('FROM_OBJECT');
    expect(raw.title_es).toBe('OBJ_ES');
  });

  it('save (new entity): translations object wins over the scalar', async () => {
    const repo = getI18nRepository(Article, ds);
    const saved = await repo.save(repo.create({ title: 'SCALAR', titleTranslations: { en: 'FROM_OBJECT', es: 'OBJ_ES' } }));
    const raw = (await ds.query('SELECT title, title_es FROM behavior_articles WHERE id = ?', [saved.id]))[0];
    expect(raw.title).toBe('FROM_OBJECT');
    expect(raw.title_es).toBe('OBJ_ES');
  });

  it('upsert: translations object wins over the scalar', async () => {
    const repo = getI18nRepository(UpsertRow, ds);
    await repo.upsert(
      { sku: 'SKU1', title: 'SCALAR', titleTranslations: { en: 'FROM_OBJECT', es: 'OBJ_ES' } } as any,
      ['sku'],
    );
    const raw = (await ds.query('SELECT title, title_es FROM behavior_upsert WHERE sku = ?', ['SKU1']))[0];
    expect(raw.title).toBe('FROM_OBJECT');
    expect(raw.title_es).toBe('OBJ_ES');
  });

  it('scalar fills only a language the translations object did not specify', async () => {
    const repo = getI18nRepository(Article, ds).setLanguage('fr');
    const saved = await repo.save(repo.create({ title: 'SCALAR_FR', titleTranslations: { en: 'OBJ_EN', es: 'OBJ_ES' } }));
    const raw = (await ds.query('SELECT title, title_es, title_fr FROM behavior_articles WHERE id = ?', [saved.id]))[0];
    expect(raw.title).toBe('OBJ_EN');   // object wins for en
    expect(raw.title_es).toBe('OBJ_ES'); // object wins for es
    expect(raw.title_fr).toBe('SCALAR_FR'); // scalar fills fr (not in the object)
  });
});

describe('composite primary key', () => {
  it('updates only the targeted row', async () => {
    const repo = getI18nRepository(Item, ds);
    await repo.save(repo.create({ tenantId: 1, itemId: 10, titleTranslations: { en: 'A-en', es: 'A-es' } }));
    await repo.save(repo.create({ tenantId: 1, itemId: 20, titleTranslations: { en: 'B-en', es: 'B-es' } }));

    const b = await repo.findOne({ where: { tenantId: 1, itemId: 20 } as any });
    b!.titleTranslations = { en: 'B-en-UPD', es: 'B-es-UPD' };
    await repo.save(b!);

    const sibling = (await ds.query('SELECT title, title_es FROM behavior_items WHERE tenantId = 1 AND itemId = 10'))[0];
    expect(sibling.title).toBe('A-en');
    expect(sibling.title_es).toBe('A-es');
  });
});

describe('concurrent-writer protection', () => {
  it('does not clobber a language the saver did not change', async () => {
    const repo = getI18nRepository(Article, ds);
    const seed = await repo.save(repo.create({ titleTranslations: { en: 'EN0', es: 'ES0', fr: 'FR0' } }));

    const a = getI18nRepository(Article, ds);
    const loaded = await a.findOne({ where: { id: seed.id } as any });
    // concurrent writer changes fr directly
    await ds.query('UPDATE behavior_articles SET title_fr = ? WHERE id = ?', ['FR_by_B', seed.id]);
    // A changes only es
    loaded!.titleTranslations = { ...loaded!.titleTranslations, es: 'ES_by_A' } as any;
    await a.save(loaded!);

    const raw = (await ds.query('SELECT title_es, title_fr FROM behavior_articles WHERE id = ?', [seed.id]))[0];
    expect(raw.title_es).toBe('ES_by_A');
    expect(raw.title_fr).toBe('FR_by_B');
  });
});

describe('QueryBuilder clone() preserves i18n context', () => {
  it('keeps language translation after clone()', async () => {
    const repo = getI18nRepository(Article, ds).setLanguage('es');
    const base = repo.createQueryBuilder('a').where({ title: 'x' } as any);
    const cloned = base.clone();
    expect(cloned.getSql()).toContain('title_es');
  });
});

describe('relation-nested where translation', () => {
  it('translates a relation i18n column in a nested where', async () => {
    const catRepo = getI18nRepository(Category, ds);
    const cat = await catRepo.save(catRepo.create({ nameTranslations: { en: 'Electronics', es: 'Electronica', fr: 'E' } }));

    const prodRepo = getI18nRepository(Product, ds);
    await prodRepo.save(prodRepo.create({ nameTranslations: { en: 'Phone', es: 'Telefono', fr: 'T' }, categoryId: cat.id }));

    const esRepo = getI18nRepository(Product, ds).setLanguage('es');
    const found = await esRepo.find({
      where: { category: { name: 'Electronica' } } as any,
      relations: { category: true } as any,
    });
    expect(found.length).toBe(1);
    expect(found[0].name).toBe('Telefono');
    expect(found[0].category?.name).toBe('Electronica');
  });
});

describe('i18nWhere export', () => {
  it('is callable and returns the where object', () => {
    expect(typeof i18nWhere).toBe('function');
    expect(i18nWhere<Article>({ title: 'x' } as any)).toEqual({ title: 'x' });
  });
});

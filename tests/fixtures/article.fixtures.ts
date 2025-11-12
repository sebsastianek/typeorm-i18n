import { I18nValue } from '../../src';
import {Article, ArticleLanguages} from "../entities/Article.entity";

export const articleFixtures: Partial<Article>[] = [
  {
    title: {
      en: 'Getting Started with TypeScript',
      de: 'Erste Schritte mit TypeScript',
      ja: 'TypeScriptを始める',
    } as I18nValue<ArticleLanguages, string>,
    content: {
      en: 'TypeScript is a typed superset of JavaScript that compiles to plain JavaScript.',
      de: 'TypeScript ist eine typisierte Obermenge von JavaScript, die in einfaches JavaScript kompiliert wird.',
      ja: 'TypeScriptは、プレーンなJavaScriptにコンパイルされるJavaScriptの型付きスーパーセットです。',
    } as I18nValue<ArticleLanguages, string>,
    viewCount: 1500,
  },
  {
    title: {
      en: 'Database Design Principles',
      de: 'Prinzipien des Datenbankdesigns',
      ja: 'データベース設計の原則',
    } as I18nValue<ArticleLanguages, string>,
    content: {
      en: 'Good database design is crucial for application performance and maintainability.',
      de: 'Gutes Datenbankdesign ist entscheidend für Anwendungsleistung und Wartbarkeit.',
      ja: '優れたデータベース設計は、アプリケーションのパフォーマンスと保守性にとって重要です。',
    } as I18nValue<ArticleLanguages, string>,
    viewCount: 2300,
  },
];

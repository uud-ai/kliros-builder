import fs from 'node:fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio';

const BU_DIR = path.resolve('public/data/bu');

const daysArg = process.argv.find(a => a.startsWith('--days='));
const DAYS_AHEAD = daysArg ? Number(daysArg.split('=')[1]) : 365;
const FORCE_RELOAD = process.argv.includes('--force');

const SECTION_RULES = [
  { id: 'ninth_hour', title: '9-й час и Малая вечерня', regex: /(?:На\s+9-м\s+часе|На\s+малой\s+вечерне)/i },
  { id: 'vespers', title: 'Вечерня', regex: /(?:На\s+великой\s+вечерне|На\s+вседневной\s+вечерне|Вечерня)/i },
  { id: 'gospodi_vozzvakh', title: 'На «Господи, воззвах»', regex: /На\s+[«"„]?Господи,\s*воззвах[»"“]?/i },
  { id: 'paremias', title: 'Вход, прокимен и паремии', regex: /(?:Прокимен\s+дня|Пареми[ия]|Вход\.)/i },
  { id: 'litiya', title: 'На литии', regex: /На\s+литии/i },
  { id: 'stichovna_vespers', title: 'На стиховне вечерни', regex: /На\s+стиховне/i },
  { id: 'troparia_vespers', title: 'Тропари по «Ныне отпущаеши»', regex: /(?:По\s+[«"„]?Ныне\s+отпущаеши[»"“]?|По\s+Трисвятом\s+—\s+тропар|Тропар[ьи]:)/i },
  { id: 'matins', title: 'Утреня', regex: /(?:На\s+утрени|Утреня)/i },
  { id: 'bog_gospod', title: 'На «Бог Господь»', regex: /На\s+[«"„]?Бог\s+Господь[»"“]?/i },
  { id: 'kathismata', title: 'Кафизмы и полиелей', regex: /(?:По\s+1-м\s+стихословии|Рядовые\s+кафизмы|Полиелей|Величание)/i },
  { id: 'canons', title: 'Каноны на утрени', regex: /(?:Канон[ы]?|По\s+3-й\s+песни|По\s+6-й\s+песни|Катавасия)/i },
  { id: 'lauds', title: 'На хвалитех и Славословие', regex: /(?:На\s+хвалитех|Великое\s+славословие)/i },
  { id: 'liturgy', title: 'Литургия', regex: /(?:На\s+литургии|Литургия|Блаженны|Прокимен,?\s+Апостол)/i }
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Перевод даты нового стиля в старый стиль (-13 дней), как делает сам сайт patriarchia.ru
function toJulianDateString(dateObj) {
  const d = new Date(dateObj);
  d.setUTCDate(d.getUTCDate() - 13);
  return d.toISOString().slice(0, 10);
}

function htmlContentToParagraphs(htmlContent) {
  const $ = cheerio.load(htmlContent || '');
  $('br').replaceWith('\n');
  $('p, div, h1, h2, h3, h4, li, tr').each((_, el) => {
    $(el).prepend('\n').append('\n');
  });

  const raw = $.text()
    .replace(/&nbsp;/g, ' ')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»');

  return raw
    .split(/\r?\n/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(line => line.length > 2)
    .join('\n');
}

function extractBookRefs(paragraph) {
  const glasMatch = paragraph.match(/гл(?:ас|\.)\s*([1-8])/i);
  const countMatch = paragraph.match(/на\s+(\d+)/i);
  const quotes = [...paragraph.matchAll(/[«"„]([^»"“]{5,80})[»"“]/g)].map(m => m[1]);

  return {
    useOktoikh: /Октоих|воскресн|восточн|Анатолиев/i.test(paragraph),
    useMineya: /Мине[ия]|свято(?:го|му|й)|святых|прп\.|свт\.|мч\.|мчч\.|вмч\.|ап\./i.test(paragraph),
    glas: glasMatch ? Number(glasMatch[1]) : null,
    totalCount: countMatch ? Number(countMatch[1]) : null,
    incipits: quotes.filter(q => !/^(Господи, воззвах|Слава|И ныне|Слава, и ныне|Бог Господь|Ныне отпущаеши)$/i.test(q))
  };
}

function parseRubricText(rawText, dateStr, oldStyleDateStr) {
  const variantRegex = /(?:^|\n)\s*([АБВГ])\.\s+([^\n]+)/g;
  const matches = [...rawText.matchAll(variantRegex)];

  const blocks = [];
  const firstLines = rawText.split('\n').slice(0, 2).join(' ');

  if (matches.length === 0) {
    blocks.push({
      id: 'variant_A',
      label: 'Основной уставной чин',
      title: firstLines.slice(0, 120) || `Богослужебные указания на ${dateStr}`,
      header: firstLines,
      content: rawText
    });
  } else {
    const header = rawText.slice(0, matches[0].index).replace(/\n+/g, ' ').trim();
    matches.forEach((m, idx) => {
      const start = m.index + m[0].length;
      const end = idx + 1 < matches.length ? matches[idx + 1].index : rawText.length;
      blocks.push({
        id: `variant_${m[1]}`,
        label: `Вариант ${m[1]}`,
        title: m[2].trim(),
        header: header.slice(0, 220),
        content: rawText.slice(start, end).trim()
      });
    });
  }

  const variants = blocks.map(block => {
    const paragraphs = block.content.split(/\n+/).map(p => p.trim()).filter(p => p.length > 3);
    const nodes = paragraphs.map(p => {
      const matchedRule = SECTION_RULES.find(r => r.regex.test(p));
      return {
        sectionId: matchedRule ? matchedRule.id : 'rubric_note',
        sectionTitle: matchedRule ? matchedRule.title : 'Указание Устава',
        rubricText: p,
        refs: extractBookRefs(p)
      };
    });

    return {
      id: block.id,
      label: block.label,
      title: block.title,
      header: block.header || '',
      nodes
    };
  });

  return {
    date: dateStr,
    oldStyleDate: oldStyleDateStr,
    source: `https://api.patriarchia.ru/v1/events/${oldStyleDateStr}`,
    variants
  };
}

async function fetchFromPatriarchiaApi(julianDateStr) {
  const apiUrl = `https://api.patriarchia.ru/v1/events/${julianDateStr}`;
  try {
    const res = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 KlirosBuilder/1.0'
      }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.content && data.content.length > 100) {
      return htmlContentToParagraphs(data.content);
    }
  } catch {
    // Ошибка сети или пустой ответ
  }
  return null;
}

async function run() {
  await fs.mkdir(BU_DIR, { recursive: true });
  const indexPath = path.join(BU_DIR, 'index.json');

  let existingDates = [];
  if (!FORCE_RELOAD) {
    try {
      existingDates = JSON.parse(await fs.readFile(indexPath, 'utf-8'));
    } catch {
      existingDates = [];
    }
  }

  const knownSet = new Set(existingDates);
  const start = new Date('2026-11-15T00:00:00Z');

  let consecutiveMisses = 0;
  let downloadedCount = 0;

  console.log(`Запрос указаний через официальный API https://api.patriarchia.ru/v1/events/... на ${DAYS_AHEAD} дн. вперед...`);

  for (let i = 0; i < DAYS_AHEAD; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const julianDateStr = toJulianDateString(d);

    if (!FORCE_RELOAD && knownSet.has(dateStr)) {
      continue;
    }

    const cleanText = await fetchFromPatriarchiaApi(julianDateStr);
    if (cleanText) {
      const parsed = parseRubricText(cleanText, dateStr, julianDateStr);
      await fs.writeFile(path.join(BU_DIR, `${dateStr}.json`), JSON.stringify(parsed, null, 2), 'utf-8');
      knownSet.add(dateStr);
      downloadedCount++;
      consecutiveMisses = 0;
      console.log(`[OK] ${dateStr} (ст. ст. ${julianDateStr}) — скачано (${cleanText.length} симв., узлов: ${parsed.variants[0]?.nodes.length || 0}, вариантов: ${parsed.variants.length})`);
    } else {
      consecutiveMisses++;
      console.log(`[Пропуск] ${dateStr} (ст. ст. ${julianDateStr}) — еще нет в базе API Патриархии`);
      if (consecutiveMisses >= 15) {
        console.log(`Остановка: 15 дат подряд еще не выложены в API Патриархии. Все доступные даты сохранены!`);
        break;
      }
    }

    await sleep(250);
  }

  const sortedDates = [...knownSet].sort();
  await fs.writeFile(indexPath, JSON.stringify(sortedDates, null, 2), 'utf-8');
  console.log(`Готово! Скачано новых дат: ${downloadedCount}. Всего дат в вашей базе: ${sortedDates.length}.`);
}

run();
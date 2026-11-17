import fs from 'node:fs/promises';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';

const OUT_DIR = path.resolve('public/data/books');
const PONOMAR_CU_DIR = path.resolve('.tmp-ponomar/Ponomar/languages/cu');

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true
});

export function parseCuGlas(headerStr) {
  if (!headerStr) return null;
  const numMatch = headerStr.match(/гла[с́]*[ъ\s]*([1-8])/i);
  if (numMatch) return Number(numMatch[1]);
  const cuMap = { 'а': 1, 'в': 2, 'г': 3, 'д': 4, 'е': 5, 'є': 5, 'ѕ': 6, 'з': 7, 'и': 8 };
  const cuMatch = headerStr.toLowerCase().match(/гла[с́]*[ъ\s]*([авгдеєѕзи])(?![а-яё])/i);
  if (cuMatch && cuMap[cuMatch[1]]) return cuMap[cuMatch[1]];
  return null;
}

export function cuToCivilWithAccents(input) {
  if (!input || typeof input !== 'string') return '';
  let text = input.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();

  // 1. Сначала раскладываем в NFD и убираем кендему (\u0308), звательные знаки (\u0485, \u0486), камору и титла
  text = text.normalize('NFD');
  text = text
    .replace(/\u0308/g, '') // убираем две точки над і (чтобы не получалась буква ӥ)
    .replace(/[\u0300\u0311]/g, '\u0301') // варию и камору переводим в острое ударение
    .replace(/[\u0483-\u0489\u2DE0-\u2DFF\uA67D\uA67F]/g, ''); // снимаем титла и надстрочные знаки

  // 2. Переводим старославянские буквы в гражданские
  const charMap = {
    'ѣ': 'е', 'Ѣ': 'Е', 'і': 'и', 'І': 'И', 'ї': 'и', 'Ї': 'И',
    'ѵ': 'и', 'Ѵ': 'И', 'ѡ': 'о', 'Ѡ': 'О', 'ѽ': 'о', 'Ѽ': 'О',
    'ѧ': 'я', 'Ѧ': 'Я', 'ѫ': 'у', 'Ѫ': 'У', 'ѩ': 'я', 'Ѩ': 'Я',
    'ѭ': 'ю', 'Ѭ': 'Ю', 'ѯ': 'кс', 'Ѯ': 'Кс', 'ѱ': 'пс', 'Ѱ': 'Пс',
    'ѳ': 'ф', 'Ѳ': 'Ф', 'ѕ': 'з', 'Ѕ': 'З', 'є': 'е', 'Є': 'Е',
    'ꙋ': 'у', 'Ꙋ': 'У'
  };
  text = text.replace(/[ѣѢіІїЇѵѴѡѠѽѼѧѦѫѪѩѨѭѬѯѮѱѰѳѲѕЅєЄꙋꙊ]/g, ch => charMap[ch] || ch);
  text = text.replace(/ъ(?=[\s.,;:!?»)—]|$)/gi, '');

  // 3. Раскрываем сокращения после снятия титл (без дублирования ударений)
  const rules = [
    [/\bблагове\u0301?рному\s+импера\u0301?тору\s+на\u0301?шему,?\s*и\u0301?мк,?/gi, 'правосла\u0301вным христиа\u0301ном'],
    [/\bкр([аоуеыи])/gi, 'крест$1'],
    [/\bкрто\u0301?м\b/gi, 'кресто\u0301м'],
    [/\bкрт\b/gi, 'крест'],
    [/\bгдь\b/gi, 'Госпо\u0301дь'],
    [/\bгди\b/gi, 'Го\u0301споди'],
    [/\bгд([аеиоуыюя])/gi, 'Го\u0301спод$1'],
    [/\bхрто\u0301?с\b/gi, 'Христо\u0301с'],
    [/\bхрт([аеиоуыюя])/gi, 'Христ$1'],
    [/\bбц([аеиоуыюя])/gi, 'Богоро\u0301диц$1'],
    [/\bбгоро\u0301?диц([аеиоуыюя])/gi, 'Богоро\u0301диц$1'],
    [/\bбг\b/gi, 'Бог'],
    [/\bбг([аеиоуыюя])/gi, 'Бо\u0301г$1'],
    [/\bбж([ийяею]+)/gi, 'Бо\u0301ж$1'],
    [/\bблгослов/gi, 'благослов'],
    [/\bблго/gi, 'благо'],
    [/\bспси\u0301?\b/gi, 'спаси\u0301'],
    [/\bспсе\b/gi, 'Спа\u0301се'],
    [/\bспс\b/gi, 'Спас'],
    [/\bспс([аеиоуыюя])/gi, 'спа\u0301с$1'],
    [/\bст([аеиоуыюя])/gi, 'свят$1'],
    [/\bапл/gi, 'апо\u0301стол'],
    [/\bмчн/gi, 'му\u0301чен'],
    [/\bсщенн/gi, 'свяще\u0301нн'],
    [/\bчлве/gi, 'челове'],
    [/\bдх\b/gi, 'Дух'],
    [/\bдх([аеиоуы])/gi, 'Ду\u0301х$1'],
    [/\bдв([аеиоуы])/gi, 'Де\u0301в$1'],
    [/\bо\u0301?че\b/gi, 'о\u0301тче'],
    [/\bмти\b/gi, 'Ма\u0301ти'],
    [/\bсн\b/gi, 'Сын'],
    [/\bсн([аеиоуы])/gi, 'Сы\u0301н$1'],
    [/\bцртв/gi, 'ца\u0301рств'],
    [/\bцрь\b/gi, 'Царь'],
    [/\bцр([юяеи])/gi, 'Цар$1'],
    [/\bмлст/gi, 'ми\u0301лост']
  ];

  for (const [pat, rep] of rules) {
    text = text.replace(pat, rep);
  }

  // 4. Переводим буквенную цифирь гласа в заголовке ("гла́с а" -> "глас 1")
  const cuDigits = { 'а': '1', 'в': '2', 'г': '3', 'д': '4', 'е': '5', 'ѕ': '6', 'з': '7', 'и': '8' };
  text = text.replace(/(гла\u0301?с\s+)([авгдеѕзи])(?![а-яё])/gi, (_, prefix, d) => prefix + (cuDigits[d.toLowerCase()] || d));

  // Убираем случайные двойные ударения подряд на одной гласной
  text = text.replace(/\u0301+/g, '\u0301');
  text = text.normalize('NFC').replace(/\s+/g, ' ').trim();

  if (text.length > 0) {
    text = text[0].toUpperCase() + text.slice(1);
  }
  return text;
}

export function splitIntoColons(civilText) {
  if (!civilText) return { colonText: '', lines: [] };
  if (civilText.includes('/')) {
    const lines = civilText.split(/\s*\/+\s*/).map(s => s.trim()).filter(Boolean);
    return { colonText: lines.join(' / '), lines };
  }
  const rawSegments = civilText.split(/(?<=[;:!?])\s+|(?<=,)\s+(?=[А-ЯЁа-яё]{3,})/g);
  const lines = [];
  let buffer = '';
  for (const seg of rawSegments) {
    if (!buffer) buffer = seg;
    else if ((buffer + ' ' + seg).length < 38 && !/[;:!?]$/.test(buffer)) buffer += ' ' + seg;
    else { lines.push(buffer.trim()); buffer = seg; }
  }
  if (buffer) lines.push(buffer.trim());
  return { colonText: lines.join(' / '), lines };
}

export function makeIncipit(civilText) {
  return (civilText || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^а-яё\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join(' ');
}

export function buildHymnItem({ id, type, category, glas, podoben, stich, rawText, rank = 'ordinary' }) {
  const civil = cuToCivilWithAccents(rawText);
  const { colonText, lines } = splitIntoColons(civil);
  return {
    id, type, rank, category,
    glas: glas || null,
    podoben: podoben ? cuToCivilWithAccents(podoben) : null,
    stich: stich ? cuToCivilWithAccents(stich) : null,
    incipit: makeIncipit(civil),
    colonText, lines
  };
}

async function loadPonomarCommonPrayers() {
  const result = { troparia: {}, kontakia: {} };
  const tropDir = path.join(PONOMAR_CU_DIR, 'xml/Services/CommonPrayers/TROPARION');
  const kontDir = path.join(PONOMAR_CU_DIR, 'xml/Services/CommonPrayers/KONTAKION');

  for (const [key, dirPath, itemType] of [
    ['troparia', tropDir, 'troparion'],
    ['kontakia', kontDir, 'kondakion']
  ]) {
    try {
      const files = (await fs.readdir(dirPath)).filter(f => f.endsWith('.xml'));
      for (const f of files) {
        const code = path.basename(f, '.xml');
        const xml = await fs.readFile(path.join(dirPath, f), 'utf-8');
        const parsed = xmlParser.parse(xml);
        const root = parsed.TROPARION || parsed.KONTAKION || parsed;
        const rawHeader = root?.HEADER?.['@_Value'] || '';
        const rawText = root?.TEXT?.['@_Value'] || '';
        if (rawText) {
          const glas = parseCuGlas(rawHeader);
          const cleanHeader = cuToCivilWithAccents(rawHeader) || (itemType === 'troparion' ? 'Тропарь' : 'Кондак');
          result[key][code] = buildHymnItem({
            id: `ponomar_${itemType}_${code}`,
            type: itemType,
            category: cleanHeader,
            glas,
            rawText
          });
        }
      }
    } catch {}
  }
  return result;
}

async function run() {
  const prayers = await loadPonomarCommonPrayers();
  console.log('Все коды TROPARION (48 шт.):', Object.keys(prayers.troparia).join(', '));
  console.log('Все коды KONTAKION (61 шт.):', Object.keys(prayers.kontakia).join(', '));

  console.log('\nПроверка очищенного FRI1:');
  console.log('  Заголовок:', prayers.troparia['FRI1'].category);
  console.log('  Строки:\n   ', prayers.troparia['FRI1'].lines.join('\n    '));

  console.log('\nПроверка MON1 (Понедельник, Бесплотным силам):');
  console.log('  Заголовок:', prayers.troparia['MON1']?.category);
  console.log('  Строки:\n   ', prayers.troparia['MON1']?.lines.join('\n    '));

  const weekdayDir = path.join(OUT_DIR, 'oktoikh', 'weekdays');
  await fs.mkdir(weekdayDir, { recursive: true });
  await fs.writeFile(path.join(weekdayDir, 'ponomar-prayers.json'), JSON.stringify(prayers, null, 2), 'utf-8');
}

run();
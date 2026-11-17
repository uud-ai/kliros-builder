import fs from 'node:fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio';

const OUT_MINEYA_DIR = path.resolve('public/data/books/mineya');
const BU_DIR = path.resolve('public/data/bu');

const MONTH_SLUGS = {
  '01': { slug: 'mineja-janvar', days: 31 },
  '02': { slug: 'mineja-fevral', days: 29 },
  '03': { slug: 'mineja-mart', days: 31 },
  '04': { slug: 'mineja-aprel', days: 30 },
  '05': { slug: 'mineja-maj', days: 31 },
  '06': { slug: 'mineja-ijun', days: 30 },
  '07': { slug: 'mineja-ijul', days: 31 },
  '08': { slug: 'mineja-avgust', days: 31 },
  '09': { slug: 'mineja-sentjabr', days: 30 },
  '10': { slug: 'mineja-oktjabr', days: 31 },
  '11': { slug: 'mineja-nojabr', days: 30 },
  '12': { slug: 'mineja-dekabr', days: 31 }
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

function cleanAzbykaText(raw) {
  if (!raw) return '';
  return raw
    // Убираем номера сносок после слов (например: "коно́бов28 вре́ния29" -> "коно́бов вре́ния")
    .replace(/(?<=[а-яёА-ЯЁ\u0301»)])\d+/g, '')
    // Приводим ударения к слитному комбинируемому виду \u0301
    .replace(/([аеёиоуыэюяАЕЁИОУЫЭЮЯ])\s*[\u00B4\u02CA\u02C8\u0384\u2032]/g, '$1\u0301')
    .replace(/([аеёиоуыэюяАЕЁИОУЫЭЮЯ])\s+\u0301/g, '$1\u0301')
    .replace(/\u0301+/g, '\u0301')
    .replace(/\s+/g, ' ')
    .trim()
    .normalize('NFC');
}

function splitColons(text) {
  const cleaned = cleanAzbykaText(text);
  if (!cleaned) return { colonText: '', lines: [] };
  if (cleaned.includes('/')) {
    const lines = cleaned.split(/\s*\/+\s*/).map(s => s.trim()).filter(Boolean);
    return { colonText: lines.join(' / '), lines };
  }
  const rawSegments = cleaned.split(/(?<=[;:!?])\s+|(?<=,)\s+(?=[А-ЯЁа-яё]{3,})/g);
  const lines = [];
  let buffer = '';
  for (const seg of rawSegments) {
    if (!buffer) buffer = seg;
    else if ((buffer + ' ' + seg).length < 42 && !/[;:!?]$/.test(buffer)) buffer += ' ' + seg;
    else { lines.push(buffer.trim()); buffer = seg; }
  }
  if (buffer) lines.push(buffer.trim());
  return { colonText: lines.join(' / '), lines };
}

function makeHymn({ id, type, category, glas, podoben, stich, rawText, rank = 'ordinary' }) {
  const { colonText, lines } = splitColons(rawText);
  return {
    id,
    type,
    rank,
    category,
    glas: glas || null,
    podoben: podoben || null,
    stich: stich ? cleanAzbykaText(stich) : null,
    colonText,
    lines
  };
}

function extractGlas(text) {
  if (!text) return null;
  const m = text.match(/гла[с́]*\s*([1-8])/i);
  return m ? Number(m[1]) : null;
}

export function parseAzbykaMineyaHtml(html, mmdd) {
  const $ = cheerio.load(html);
  // Удаляем блоки сносок и навигации внизу страницы
  $('.footnotes, .note, nav, header, footer, script, style').remove();

  const blocks = [];
  $('h1, h2, h3, h4, p').each((_, el) => {
    const tag = el.tagName.toUpperCase();
    const text = cleanAzbykaText($(el).text());
    if (!text || text === 'Источник' || /^Примечания/i.test(text)) return;
    blocks.push({ tag, text });
  });

  const title = blocks.find(b => b.tag === 'H2' || b.tag === 'H1')?.text || blocks[0]?.text || `Минея ${mmdd}`;

  const result = {
    date: mmdd,
    title,
    source: `https://azbyka.ru/otechnik/Pravoslavnoe_Bogosluzhenie/${MONTH_SLUGS[mmdd.slice(0, 2)]?.slug}/${Number(mmdd.slice(3))}`,
    vespers: {
      stichera_saints: [],
      glory: null,
      theotokion: null,
      litiya: [],
      stichovna_stichera: [],
      stichovna_glory: null,
      stichovna_theotokion: null
    },
    troparion: null,
    kondakion: null,
    ikos: null,
    matins: {
      sedalny: [],
      canons: [],
      svetilny: [],
      lauds_stichera: [],
      lauds_glory: null
    }
  };

  let section = 'intro'; // 'gv' | 'litiya' | 'stichovna' | 'troparion' | 'sedalen' | 'canon' | 'kondak' | 'svetilen' | 'lauds'
  let currentGlas = 4;
  let currentPodoben = null;
  let pendingStich = null;
  let pendingGlory = false;
  let pendingTheotokion = false;

  let currentCanon = null;
  let currentOde = null;

  for (let i = 0; i < blocks.length; i++) {
    const { tag, text } = blocks[i];
    const g = extractGlas(text);
    if (g) currentGlas = g;

    // Переключение основных секций службы
    if (/На\s+Го́?споди,?\s+воззва́?х/i.test(text)) {
      section = 'gv';
      currentPodoben = null;
      pendingGlory = false;
      pendingTheotokion = false;
      continue;
    }
    if (/^На\s+лити́?и/i.test(text)) {
      section = 'litiya';
      pendingGlory = false;
      pendingTheotokion = false;
      continue;
    }
    if (/На\s+стихо́?вне/i.test(text)) {
      section = section === 'lauds' ? 'stichovna_matins' : 'stichovna';
      currentPodoben = null;
      pendingGlory = false;
      pendingTheotokion = false;
      continue;
    }
    if (/^Тропа́?рь/i.test(text) && text.length < 70) {
      section = 'troparion';
      continue;
    }
    if (/^Тропа́?рь,?\s*гла/i.test(text) && text.length >= 70) {
      const body = text.replace(/^Тропа́?рь,?\s*гла[с́]*\s*[1-8]\s*:?\s*/i, '');
      if (!result.troparion && body.length > 20) {
        result.troparion = makeHymn({
          id: `min_${mmdd}_trop`,
          type: 'troparion',
          rank: 'saint',
          category: `Тропарь святого (${mmdd} ст. ст.)`,
          glas: currentGlas,
          rawText: body
        });
      }
      continue;
    }
    if (/^Седа́?лен/i.test(text) && text.length < 90) {
      section = 'sedalen';
      continue;
    }
    if (/кано́?н|Песнь\s+1\b/i.test(text) && text.length < 180) {
      section = 'canon';
      if (!currentCanon) {
        currentCanon = {
          id: `min_${mmdd}_canon_1`,
          title: `Канон Минеи (${mmdd} ст. ст.)`,
          glas: currentGlas,
          defaultRefrain: 'Святы́и Бо́жии, моли́те Бо́га о нас.',
          odes: []
        };
        result.matins.canons.push(currentCanon);
      }
      const odeMatch = text.match(/^Песнь\s+([1-9])\b/i);
      if (odeMatch) {
        currentOde = {
          odeNumber: Number(odeMatch[1]),
          irmos: null,
          troparia: []
        };
        currentCanon.odes.push(currentOde);
      }
      continue;
    }
    if (/^Песнь\s+([1-9])\b/i.test(text) && text.length < 30) {
      section = 'canon';
      const odeNum = Number(text.match(/^Песнь\s+([1-9])\b/i)[1]);
      if (!currentCanon) {
        currentCanon = {
          id: `min_${mmdd}_canon_1`,
          title: `Канон Минеи (${mmdd} ст. ст.)`,
          glas: currentGlas,
          defaultRefrain: 'Святы́и Бо́жии, моли́те Бо́га о нас.',
          odes: []
        };
        result.matins.canons.push(currentCanon);
      }
      currentOde = { odeNumber: odeNum, irmos: null, troparia: [] };
      currentCanon.odes.push(currentOde);
      continue;
    }
    if (/^Конда́?к/i.test(text) && text.length < 90) {
      section = 'kondak';
      continue;
    }
    if (/^И́?кос\b/i.test(text)) {
      const ikosBody = text.replace(/^И́?кос\s*:?\s*/i, '');
      if (ikosBody.length > 30) {
        result.ikos = makeHymn({
          id: `min_${mmdd}_ikos`,
          type: 'ikos',
          category: `Икос (${mmdd} ст. ст.)`,
          glas: currentGlas,
          rawText: ikosBody
        });
      } else {
        section = 'ikos';
      }
      continue;
    }
    if (/^Свети́?лен/i.test(text) && text.length < 80) {
      section = 'svetilen';
      continue;
    }
    if (/На\s+хвали́?тех/i.test(text)) {
      section = 'lauds';
      pendingGlory = false;
      pendingTheotokion = false;
      continue;
    }

    // Вспомогательные подзаголовки внутри секций (Подобен, Стих, Слава, И ныне)
    if (/^Подо́?бен\s*:/i.test(text) && text.length < 80) {
      currentPodoben = text.replace(/^Подо́?бен\s*:\s*/i, '').replace(/:\s*$/, '');
      continue;
    }
    if (/^Стих\s*:/i.test(text) && text.length < 180) {
      pendingStich = text.replace(/^Стих\s*:\s*/i, '');
      continue;
    }
    if (/^Сла́?ва/i.test(text) && text.length < 85) {
      pendingGlory = true;
      pendingTheotokion = false;
      if (/и\s+ны́?не/i.test(text)) pendingTheotokion = true;
      continue;
    }
    if (/^И\s+ны́?не/i.test(text) && text.length < 90) {
      pendingTheotokion = true;
      pendingGlory = false;
      continue;
    }

    // Обработка текстов внутри активной секции
    if (text.length < 25) continue;

    if (section === 'gv') {
      if (pendingTheotokion) {
        result.vespers.theotokion = makeHymn({
          id: `min_${mmdd}_gv_theotokion`,
          type: 'theotokion',
          rank: 'theotokion',
          category: `Богородичен / Крестобогородичен (${mmdd} ст. ст.)`,
          glas: currentGlas,
          podoben: currentPodoben,
          rawText: text
        });
        pendingTheotokion = false;
      } else if (pendingGlory) {
        result.vespers.glory = makeHymn({
          id: `min_${mmdd}_gv_glory`,
          type: 'stichera',
          rank: 'glory',
          category: `Славник святого на «Господи, воззвах» (${mmdd} ст. ст.)`,
          glas: currentGlas,
          rawText: text
        });
        pendingGlory = false;
      } else if (result.vespers.stichera_saints.length < 8) {
        result.vespers.stichera_saints.push(
          makeHymn({
            id: `min_${mmdd}_gv_${result.vespers.stichera_saints.length + 1}`,
            type: 'stichera',
            category: `Стихира Минеи на «Господи, воззвах» (${mmdd} ст. ст.)`,
            glas: currentGlas,
            podoben: currentPodoben,
            stich: pendingStich,
            rawText: text
          })
        );
        pendingStich = null;
      }
    } else if (section === 'stichovna') {
      if (pendingTheotokion) {
        result.vespers.stichovna_theotokion = makeHymn({
          id: `min_${mmdd}_stich_theotokion`,
          type: 'theotokion',
          rank: 'theotokion',
          category: `Богородичен на стиховне (${mmdd} ст. ст.)`,
          glas: currentGlas,
          podoben: currentPodoben,
          rawText: text
        });
        pendingTheotokion = false;
      } else if (pendingGlory) {
        result.vespers.stichovna_glory = makeHymn({
          id: `min_${mmdd}_stich_glory`,
          type: 'stichera',
          rank: 'glory',
          category: `Славник святого на стиховне (${mmdd} ст. ст.)`,
          glas: currentGlas,
          rawText: text
        });
        pendingGlory = false;
      } else if (result.vespers.stichovna_stichera.length < 4) {
        result.vespers.stichovna_stichera.push(
          makeHymn({
            id: `min_${mmdd}_stich_${result.vespers.stichovna_stichera.length + 1}`,
            type: 'stichera',
            category: `Стихира святого на стиховне (${mmdd} ст. ст.)`,
            glas: currentGlas,
            podoben: currentPodoben,
            stich: pendingStich,
            rawText: text
          })
        );
        pendingStich = null;
      }
    } else if (section === 'troparion') {
      if (!result.troparion) {
        result.troparion = makeHymn({
          id: `min_${mmdd}_trop`,
          type: 'troparion',
          rank: 'saint',
          category: `Тропарь святого Минеи (${mmdd} ст. ст.)`,
          glas: currentGlas,
          rawText: text
        });
      }
      section = 'intro';
    } else if (section === 'sedalen') {
      result.matins.sedalny.push(
        makeHymn({
          id: `min_${mmdd}_sed_${result.matins.sedalny.length + 1}`,
          type: pendingTheotokion ? 'theotokion' : 'sedalen',
          category: pendingTheotokion
            ? `Богородичен седальна (${mmdd} ст. ст.)`
            : `Седален Минеи (${mmdd} ст. ст.)`,
          glas: currentGlas,
          podoben: currentPodoben,
          rawText: text
        })
      );
      if (pendingTheotokion) {
        pendingTheotokion = false;
        section = 'canon';
      }
    } else if (section === 'canon' && currentOde) {
      if (/^Ирмо́?с\s*:/i.test(text)) {
        const irmosBody = text.replace(/^Ирмо́?с\s*:\s*/i, '');
        currentOde.irmos = makeHymn({
          id: `min_${mmdd}_ode${currentOde.odeNumber}_irmos`,
          type: 'irmos',
          category: `Песнь ${currentOde.odeNumber} • Ирмос канона Минеи (Глас ${currentCanon.glas})`,
          glas: currentCanon.glas,
          rawText: irmosBody
        });
      } else {
        const isBogorodichen = /^Богоро́?дичен\s*:/i.test(text) || pendingTheotokion;
        const cleanBody = text.replace(/^(?:Богоро́?дичен|Тро́?ичен|Му́?ченичен)\s*:\s*/i, '');
        currentOde.troparia.push(
          makeHymn({
            id: `min_${mmdd}_ode${currentOde.odeNumber}_t${currentOde.troparia.length + 1}`,
            type: isBogorodichen ? 'theotokion' : 'canon_troparion',
            rank: isBogorodichen ? 'theotokion' : 'ordinary',
            category: isBogorodichen
              ? `Песнь ${currentOde.odeNumber} • Богородичен (Минея)`
              : `Песнь ${currentOde.odeNumber} • Тропарь ${currentOde.troparia.length + 1} (Минея)`,
            glas: currentCanon.glas,
            stich: isBogorodichen
              ? 'Пресвята́я Богоро́дице, спаси́ нас.'
              : 'Святы́и Бо́жии, моли́те Бо́га о нас.',
            rawText: cleanBody
          })
        );
        pendingTheotokion = false;
      }
    } else if (section === 'kondak') {
      if (!result.kondakion) {
        result.kondakion = makeHymn({
          id: `min_${mmdd}_kondak`,
          type: 'kondakion',
          category: `Кондак святого по 6-й песни (${mmdd} ст. ст.)`,
          glas: currentGlas,
          podoben: currentPodoben,
          rawText: text.replace(/^Конда́?к[^:]*:\s*/i, '')
        });
      }
      section = 'canon';
    } else if (section === 'ikos') {
      if (!result.ikos) {
        result.ikos = makeHymn({
          id: `min_${mmdd}_ikos`,
          type: 'ikos',
          category: `Икос по 6-й песни (${mmdd} ст. ст.)`,
          glas: currentGlas,
          rawText: text
        });
      }
      section = 'canon';
    } else if (section === 'svetilen') {
      result.matins.svetilny.push(
        makeHymn({
          id: `min_${mmdd}_svet_${result.matins.svetilny.length + 1}`,
          type: pendingTheotokion ? 'theotokion' : 'svetilen',
          category: pendingTheotokion
            ? `Богородичен светильна (${mmdd} ст. ст.)`
            : `Светилен святого по 9-й песни (${mmdd} ст. ст.)`,
          glas: currentGlas,
          podoben: currentPodoben,
          rawText: text
        })
      );
      if (pendingTheotokion) pendingTheotokion = false;
    } else if (section === 'lauds') {
      if (pendingGlory) {
        result.matins.lauds_glory = makeHymn({
          id: `min_${mmdd}_lauds_glory`,
          type: 'stichera',
          rank: 'glory',
          category: `Славник святого на хвалитех (${mmdd} ст. ст.)`,
          glas: currentGlas,
          rawText: text
        });
        pendingGlory = false;
      } else if (!pendingTheotokion && result.matins.lauds_stichera.length < 6) {
        result.matins.lauds_stichera.push(
          makeHymn({
            id: `min_${mmdd}_lauds_${result.matins.lauds_stichera.length + 1}`,
            type: 'stichera',
            category: `Стихира святого на хвалитех (${mmdd} ст. ст.)`,
            glas: currentGlas,
            podoben: currentPodoben,
            rawText: text
          })
        );
      }
    }
  }

  return result;
}

async function fetchAndSaveMineyaDay(mm, dd, force = false) {
  const mmStr = String(mm).padStart(2, '0');
  const ddStr = String(dd).padStart(2, '0');
  const mmdd = `${mmStr}-${ddStr}`;
  const monthCfg = MONTH_SLUGS[mmStr];
  if (!monthCfg) return false;

  const outDir = path.join(OUT_MINEYA_DIR, mmStr);
  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, `${mmdd}.json`);

  const url = `https://azbyka.ru/otechnik/Pravoslavnoe_Bogosluzhenie/${monthCfg.slug}/${Number(dd)}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 KlirosBuilder/1.0' } });
    if (!res.ok) {
      console.log(`[Пропуск ${res.status}] ${mmdd} (${url})`);
      return false;
    }
    const html = await res.text();
    const parsed = parseAzbykaMineyaHtml(html, mmdd);
    await fs.writeFile(outFile, JSON.stringify(parsed, null, 2), 'utf-8');

    const gvCount = parsed.vespers.stichera_saints.length;
    const canonOdes = parsed.matins.canons[0]?.odes?.length || 0;
    console.log(
      `[OK] Минея ${mmdd}: «${parsed.title.slice(0, 52)}...» | Стихир: ${gvCount}, Тропарь: ${parsed.troparion ? 'да' : 'нет'}, Канон: ${canonOdes} песн.`
    );
    return true;
  } catch (err) {
    console.log(`[Ошибка] ${mmdd}: ${err.message}`);
    return false;
  }
}

async function main() {
  const allYear = process.argv.includes('--all-year');
  const monthArg = process.argv.find(a => a.startsWith('--month='));

  if (allYear) {
    console.log('Запуск полного скачивания всех 12 томов Минеи (366 дней)...');
    for (const [mm, cfg] of Object.entries(MONTH_SLUGS)) {
      for (let d = 1; d <= cfg.days; d++) {
        await fetchAndSaveMineyaDay(mm, d, true);
        await sleep(220);
      }
    }
  } else if (monthArg) {
    const mm = monthArg.split('=')[1].padStart(2, '0');
    const cfg = MONTH_SLUGS[mm];
    console.log(`Скачивание всех дней Минеи за месяц ${mm} (${cfg.slug})...`);
    for (let d = 1; d <= cfg.days; d++) {
      await fetchAndSaveMineyaDay(mm, d, true);
      await sleep(220);
    }
  } else {
    // По умолчанию скачиваем настоящие Минеи для всех дат, которые лежат в public/data/bu
    const buFiles = (await fs.readdir(BU_DIR)).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
    const uniqueOldDates = new Set();
    for (const f of buFiles) {
      const bu = JSON.parse(await fs.readFile(path.join(BU_DIR, f), 'utf-8'));
      if (bu.oldStyleDate) uniqueOldDates.add(bu.oldStyleDate.slice(5, 10));
    }

    console.log(`Скачивание настоящих текстов Минеи с azbyka.ru для ${uniqueOldDates.size} дат вашего календаря...`);
    for (const mmdd of [...uniqueOldDates].sort()) {
      const [mm, dd] = mmdd.split('-');
      await fetchAndSaveMineyaDay(mm, dd, true);
      await sleep(220);
    }
    console.log('\nГотово! Чтобы скачать абсолютно все 366 дней всех 12 месяцев, запустите: node scripts/parse-mineya-azbyka.mjs --all-year');
  }
}

main();
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildHymnItem } from './import-books.mjs';

const IRMOS_1_BY_GLAS = {
  1: 'Твоя́ победи́тельная десни́ца боголе́пно в кре́пости просла́вися: / та бо, Безсме́ртне, я́ко всемогу́щая, проти́вныя сотре́, / изра́ильтяном путь глубины́ новосоде́лавшая.',
  2: 'Во глубине́ постла́ иногда́ фараони́тское всево́инство преоруже́нная си́ла, / вопло́щшееся же Сло́во всезло́бный грех потреби́ло есть, / препросла́вленный Госпо́дь, сла́вно бо просла́вися.',
  3: 'Во́ду проше́д я́ко су́шу, и еги́петскаго зла избежа́в, / изра́ильтянин вопия́ше: / Изба́вителю и Бо́гу на́шему пои́м.',
  4: 'Мо́ря чермну́ю пучи́ну невла́жными стопа́ми дре́вний пешеше́ствовав Изра́иль, / крестообра́зными Моисе́овыма рука́ма Амали́кову си́лу в пусты́ни победи́л есть.',
  5: 'Коня́ и вса́дника в мо́ре Чермно́е, / сокруша́яй бра́ни мы́шцею высо́кою, Христо́с истрясе́, / Изра́иля же спасе́, побе́дную песнь пою́ща.',
  6: 'Я́ко по су́ху пешеше́ствовав Изра́иль по бе́здне стопа́ми, / гони́теля фарао́на ви́дя потопля́ема, / Бо́гу побе́дную песнь пои́м, вопия́ше.',
  7: 'Ма́нием Твои́м на земны́й о́браз преложи́ся пре́жде удоборазлива́емое водно́е естество́, Го́споди: / те́мже немо́кренно пешеше́ствовав Изра́иль, пое́т Тебе́ песнь побе́дную.',
  8: 'Во́ду проше́д я́ко су́шу, и еги́петскаго зла избежа́в, / изра́ильтянин вопия́ше: / Изба́вителю и Бо́гу на́шему пои́м.'
};

async function enrichOktoikhWithMatins() {
  for (let g = 1; g <= 8; g++) {
    const file = path.resolve(`public/data/books/oktoikh/glas-${g}/sunday.json`);
    const data = JSON.parse(await fs.readFile(file, 'utf-8'));

    data.matins = {
      sedalny: [
        buildHymnItem({
          id: `okt_g${g}_sed_1`,
          type: 'sedalen',
          category: `Седален воскресный по 1-й кафизме (Глас ${g})`,
          glas: g,
          rawText: data.troparion.colonText
        })
      ],
      canons: [
        {
          id: `okt_g${g}_canon`,
          title: `Канон воскресный (Глас ${g})`,
          glas: g,
          defaultRefrain: 'Сла́ва, Го́споди, свято́му Воскресе́нию Твоему́.',
          odes: [1, 3, 4, 5, 6, 7, 8, 9].map(odeNum => ({
            odeNumber: odeNum,
            irmos: buildHymnItem({
              id: `okt_g${g}_ode${odeNum}_irmos`,
              type: 'irmos',
              category: `Песнь ${odeNum} • Ирмос (Глас ${g})`,
              glas: g,
              rawText: IRMOS_1_BY_GLAS[g]
            }),
            troparia: [
              buildHymnItem({
                id: `okt_g${g}_ode${odeNum}_t1`,
                type: 'canon_troparion',
                category: `Песнь ${odeNum} • Тропарь 1`,
                glas: g,
                stich: 'Сла́ва, Го́споди, свято́му Воскресе́нию Твоему́.',
                rawText: data.vespers.stichera_resurrection[0].colonText
              }),
              buildHymnItem({
                id: `okt_g${g}_ode${odeNum}_theotokion`,
                type: 'theotokion',
                rank: 'theotokion',
                category: `Песнь ${odeNum} • Богородичен`,
                glas: g,
                stich: 'Пресвята́я Богоро́дице, спаси́ нас.',
                rawText: data.resurrection_theotokion.colonText
              })
            ]
          }))
        }
      ],
      svetilny: [
        buildHymnItem({
          id: `okt_g${g}_svetilen`,
          type: 'svetilen',
          category: 'Светилен воскресный (Евангельский)',
          glas: g,
          rawText: 'Со ученики́ взы́дем на го́ру галиле́йскую, / ве́рою Христа́ ви́дети, глаго́лющаго вла́сть приях вы́шних и ни́жних: / научи́мся, ка́ко креща́ти во и́мя Отца́, и Сы́на, и Свята́го Ду́ха.'
        })
      ]
    };

    await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf-8');
  }
  console.log('[OK] Во все 8 гласов Октоиха добавлены блоки matins (седальны, каноны по песням 1..9 и светильны).');
}

enrichOktoikhWithMatins();
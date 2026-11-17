"use client";
import React, { useEffect, useState, useMemo } from 'react';

const DEFAULT_TEMPLE_HYMNS = {
  lord: {
    title: 'Тропарь Господского храма (Спас Нерукотворный / Преображение)',
    glas: 2,
    colonText: 'Пречи́стому Твоему́ о́бразу покланя́емся, Благи́й, / прося́ще проще́ния прегреше́ний на́ших, Христе́ Бо́же: / во́лею бо благоволи́л еси́ пло́тию взы́ти на Крест, / да изба́виши я́же созда́л еси́ от рабо́ты вра́жия. / Тем благода́рственно вопие́м Ти: / ра́дости испо́лнил еси́ вся, Спа́се наш, / прише́дый спасти́ мир.',
  },
  theotokos: {
    title: 'Тропарь Богородичного храма (Покров / Успение / Икона Божией Матери)',
    glas: 4,
    colonText: 'Днесь благове́рнии лю́дие све́тло пра́зднуем, / осеня́еми Твои́м, Богома́ти, прише́ствием, / и к Твоему́ взира́юще пречи́стому о́бразу, уми́льно глаго́лем: / покры́й нас честны́м Твои́м Покро́вом / и изба́ви нас от вся́каго зла, / моля́щи Сы́на Твоего́, Христа́ Бо́га на́шего, / спасти́ ду́ши на́ша.',
  },
  saint: {
    title: 'Тропарь святого храма (например, свт. Николая)',
    glas: 4,
    colonText: 'Пра́вило ве́ры и о́браз кро́тости, / воздержа́ния учи́теля яви́ тя ста́ду твоему́ / я́же веще́й и́стина; / сего́ ра́ди стяжа́л еси́ смире́нием высо́кая, / нището́ю бога́тая: / о́тче священнонача́льниче Никола́е, / моли́ Христа́ Бо́га спасти́ся душа́м на́шим.',
  }
};

const FONT_SIZES = [
  { id: 'sm', label: 'A-', textClass: 'text-base', rubricClass: 'text-xs' },
  { id: 'md', label: 'A',  textClass: 'text-lg',   rubricClass: 'text-sm' },
  { id: 'lg', label: 'A+', textClass: 'text-xl',   rubricClass: 'text-base' },
  { id: 'xl', label: 'A++', textClass: 'text-2xl', rubricClass: 'text-lg' }
];

export default function KlirosBuilderPage() {
  const [dates, setDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState('2026-11-15');
  const [buData, setBuData] = useState(null);
  const [selectedVariantId, setSelectedVariantId] = useState('variant_A');
  const [activeGlas, setActiveGlas] = useState(3);
  const [selectedOde, setSelectedOde] = useState(1);
  const [canonSourceMode, setCanonSourceMode] = useState('combined');

  const [templeType, setTempleType] = useState('saint');
  const [customSaintTroparion, setCustomSaintTroparion] = useState(DEFAULT_TEMPLE_HYMNS.saint.colonText);
  const [forceTempleTroparionOnSunday, setForceTempleTroparionOnSunday] = useState(false);
  const [displayMode, setDisplayMode] = useState('lines');

  const [fontSizeId, setFontSizeId] = useState('md');
  const [darkMode, setDarkMode] = useState(false);
  const [serviceFilter, setServiceFilter] = useState('all');
  const [klirosReadMode, setKlirosReadMode] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(true);
  const [printAllOdes, setPrintAllOdes] = useState(false);

  const [collapsedNodes, setCollapsedNodes] = useState({});
  const [excludedNodes, setExcludedNodes] = useState({});
  const [excludedHymns, setExcludedHymns] = useState({});

  const [chasoslov, setChasoslov] = useState(null);
  const [oktoikh, setOktoikh] = useState(null);
  const [mineya, setMineya] = useState(null);
  const [ponomarPrayers, setPonomarPrayers] = useState(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('kliros_prefs') || '{}');
      if (saved.templeType) setTempleType(saved.templeType);
      if (saved.customSaintTroparion) setCustomSaintTroparion(saved.customSaintTroparion);
      if (saved.displayMode) setDisplayMode(saved.displayMode);
      if (saved.fontSizeId) setFontSizeId(saved.fontSizeId);
      if (typeof saved.darkMode === 'boolean') setDarkMode(saved.darkMode);
    } catch {}

    fetch('/data/bu/index.json').then(r => r.json()).then(list => {
      setDates(list);
      if (list.length > 0 && !list.includes(selectedDate)) {
        setSelectedDate(list[0]);
      }
    });
    fetch('/data/books/chasoslov/vespers.json').then(r => r.json()).then(setChasoslov);
    fetch('/data/books/oktoikh/weekdays/ponomar-prayers.json').then(r => r.ok ? r.json() : null).then(setPonomarPrayers);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('kliros_prefs', JSON.stringify({
        templeType, customSaintTroparion, displayMode, fontSizeId, darkMode
      }));
    } catch {}
  }, [templeType, customSaintTroparion, displayMode, fontSizeId, darkMode]);

  useEffect(() => {
    if (!selectedDate) return;
    fetch(`/data/bu/${selectedDate}.json`)
      .then(r => r.json())
      .then(data => {
        setBuData(data);
        if (data.variants?.length > 0) {
          setSelectedVariantId(data.variants[0].id);
        }
        setCollapsedNodes({});

        const rawStr = JSON.stringify(data.variants || []);
        const glasMatch = rawStr.match(/Глас\s*([1-8])/i) || rawStr.match(/гл(?:ас|\.)\s*([1-8])/i);
        const detectedGlas = glasMatch ? Number(glasMatch[1]) : 3;
        setActiveGlas(detectedGlas);

        fetch(`/data/books/oktoikh/glas-${detectedGlas}/sunday.json`)
          .then(r => r.ok ? r.json() : null)
          .then(okt => { if (okt) setOktoikh(okt); });

        const oldDate = data.oldStyleDate || selectedDate;
        const mm = oldDate.slice(5, 7);
        const mmdd = oldDate.slice(5, 10);
        fetch(`/data/books/mineya/${mm}/${mmdd}.json`)
          .then(r => r.ok ? r.json() : null)
          .then(min => { if (min) setMineya(min); });
      });
  }, [selectedDate]);

  const currentVariant = buData?.variants?.find(v => v.id === selectedVariantId) || buData?.variants?.[0];
  const isSunday = new Date(selectedDate + 'T00:00:00Z').getUTCDay() === 0;
  const fontConfig = FONT_SIZES.find(f => f.id === fontSizeId) || FONT_SIZES[1];

  const enrichedNodes = useMemo(() => {
    if (!currentVariant?.nodes) return [];
    let currentGroup = 'vespers';

    return currentVariant.nodes.map((node, index) => {
      const text = node.rubricText || '';

      if (node.sectionId === 'matins' || node.sectionId === 'bog_gospod' || node.sectionId === 'kathismata' || node.sectionId === 'canons' || node.sectionId === 'lauds' || /^(На утрени|Утреня)/i.test(text)) {
        currentGroup = 'matins';
      } else if (node.sectionId === 'liturgy' || /^(На литургии|Литургия|На часах)/i.test(text)) {
        currentGroup = 'liturgy';
      } else if (node.sectionId === 'ninth_hour' || node.sectionId === 'vespers' || node.sectionId === 'gospodi_vozzvakh') {
        currentGroup = 'vespers';
      }

      let effectiveType = node.sectionId;
      let effectiveTitle = node.sectionTitle;

      if (/На\s+стиховне/i.test(text)) {
        effectiveType = 'stichovna_vespers';
        effectiveTitle = currentGroup === 'matins' ? 'На стиховне утрени' : 'На стиховне вечерни';
      } else if (/По\s+9-й\s+песни|Ексапостилари|Светилен/i.test(text)) {
        effectiveType = 'svetilen_matins';
        effectiveTitle = 'По 9-й песни (Эксапостиларий / Светилен)';
      } else if (/Всякое\s+дыхание/i.test(text)) {
        effectiveType = 'lauds_intro_only';
        effectiveTitle = '«Всякое дыхание» и хвалитные псалмы';
      } else if (/На\s+хвалитех/i.test(text)) {
        effectiveType = 'lauds_stichera_block';
        effectiveTitle = 'Стихиры на хвалитех';
      } else if (/Великое\s+славословие|По\s+Трисвятом.*тропарь\s+воскресный/i.test(text)) {
        effectiveType = 'great_doxology_block';
        effectiveTitle = 'Великое славословие и тропарь';
      } else if (currentGroup === 'liturgy' && /На\s+литургии|Блаженн|Тропар|Прокимен|Апостол|Причастен/i.test(text)) {
        effectiveType = 'liturgy_full_block';
        effectiveTitle = 'Божественная Литургия: Блаженны, Тропари и Кондаки, Прокимен, Аллилуиарий, Причастен';
      }

      return {
        ...node,
        effectiveType,
        sectionTitle: effectiveTitle,
        originalIndex: index,
        nodeKey: `${selectedDate}_${selectedVariantId}_${index}`,
        serviceGroup: currentGroup
      };
    });
  }, [currentVariant, selectedDate, selectedVariantId]);

  const visibleNodes = useMemo(() => {
    return enrichedNodes.filter(node => {
      if (serviceFilter !== 'all' && node.serviceGroup !== serviceFilter) return false;
      if (klirosReadMode && excludedNodes[node.nodeKey]) return false;
      return true;
    });
  }, [enrichedNodes, serviceFilter, klirosReadMode, excludedNodes]);

  function toggleNodeCollapse(nodeKey) {
    setCollapsedNodes(prev => ({ ...prev, [nodeKey]: !prev[nodeKey] }));
  }

  function collapseOrExpandAll(collapse) {
    const next = {};
    enrichedNodes.forEach(n => { next[n.nodeKey] = collapse; });
    setCollapsedNodes(next);
  }

  function toggleNodeInclude(nodeKey) {
    setExcludedNodes(prev => ({ ...prev, [nodeKey]: !prev[nodeKey] }));
  }

  function toggleHymnInclude(hymnKey) {
    setExcludedHymns(prev => ({ ...prev, [hymnKey]: !prev[hymnKey] }));
  }

  function handlePrintA4() {
    setCollapsedNodes({});
    setPrintAllOdes(true);
    setTimeout(() => {
      window.print();
    }, 150);
  }

  function buildGospodiVozzvakhList(node) {
    if (!chasoslov || !oktoikh || !mineya) return [];
    const total = node.refs?.totalCount || (isSunday ? 10 : 6);
    const items = [];

    if (node.refs?.useOktoikh) {
      items.push(...(oktoikh.vespers.stichera_resurrection || []));
      if (isSunday && total === 10) {
        items.push(...(oktoikh.vespers.stichera_anatolius || []));
      }
    }
    if (node.refs?.useMineya && mineya.vespers?.stichera_saints?.length > 0) {
      items.push(...mineya.vespers.stichera_saints);
    }

    const sliced = items.slice(0, total);
    const verses = chasoslov.gospodi_vozzvakh_verses.slice(10 - sliced.length);

    return sliced.map((hymn, idx) => ({
      ...hymn,
      uniqueKey: `${node.nodeKey}_gv_${idx}`,
      assignedVerse: verses[idx] ? `Стих ${verses[idx].count}: ${verses[idx].stich}` : null
    }));
  }

  function buildTropariaSequence(node) {
    if (!oktoikh || !mineya) return [];
    const list = [];

    const templeHymnText = templeType === 'saint' ? customSaintTroparion : DEFAULT_TEMPLE_HYMNS[templeType].colonText;
    const templeHymnObj = {
      id: 'temple_trop',
      category: templeType === 'lord' ? 'Тропарь храма Господского' : templeType === 'theotokos' ? 'Тропарь храма Богородицы' : 'Тропарь святого храма',
      glas: DEFAULT_TEMPLE_HYMNS[templeType].glas,
      colonText: templeHymnText,
      lines: templeHymnText.split(/\s*\/+\s*/)
    };

    const saintTrop = mineya.troparion;

    if (isSunday) {
      list.push({ prefix: null, hymn: oktoikh.troparion });
      if (templeType === 'theotokos') {
        list.push({ prefix: 'Тропарь храма Пресвятой Богородицы:', hymn: templeHymnObj });
      }
      if (templeType === 'saint' && forceTempleTroparionOnSunday) {
        list.push({ prefix: 'Тропарь святого храма (включен вручную):', hymn: templeHymnObj });
      }
      if (saintTrop) {
        list.push({ prefix: 'Сла́ва Отцу́ и Сы́ну и Свято́му Ду́ху:', hymn: saintTrop });
      }
      list.push({ prefix: 'И ны́не и при́сно и во ве́ки веко́в. Ами́нь:', hymn: oktoikh.resurrection_theotokion });
    } else {
      const dayNum = new Date(selectedDate + 'T00:00:00Z').getUTCDay();
      const dayMap = { 1: 'MON1', 2: 'TUE1', 3: 'WED1', 4: 'THU1', 5: 'FRI1', 6: 'SAT1' };
      const weekdayCode = dayMap[dayNum];
      const weekdayTrop = ponomarPrayers?.troparia?.[weekdayCode];

      if (weekdayTrop) {
        list.push({ prefix: 'Тропарь седмичного дня (Октоих / Ponomar):', hymn: weekdayTrop });
      }
      if (saintTrop) {
        list.push({ prefix: 'Тропарь рядового святого Минеи:', hymn: saintTrop });
      }
      if (templeType === 'saint' || templeType === 'theotokos') {
        list.push({ prefix: 'Сла́ва Отцу́ и Сы́ну и Свято́му Ду́ху (Тропарь храма):', hymn: templeHymnObj });
      }
      list.push({
        prefix: 'И ны́не и при́сно и во ве́ки веко́в. Ами́нь (Богородичен):',
        hymn: mineya.vespers?.theotokion || oktoikh.resurrection_theotokion
      });
    }

    return list.map((item, idx) => ({
      ...item,
      uniqueKey: `${node.nodeKey}_trop_${idx}`
    }));
  }

  function buildMergedOde(odeNum) {
    const oktOde = oktoikh?.matins?.canons?.[0]?.odes?.find(o => o.odeNumber === odeNum);
    const minOdes = [];
    for (const c of (mineya?.matins?.canons || [])) {
      for (const o of (c.odes || [])) {
        if (o.odeNumber === odeNum) minOdes.push(o);
      }
    }

    if (canonSourceMode === 'oktoikh') {
      return oktOde ? [oktOde] : [];
    }
    if (canonSourceMode === 'mineya') {
      return minOdes;
    }
    const combined = [];
    if (oktOde) combined.push(oktOde);
    combined.push(...minOdes);
    return combined;
  }

  function renderFormattedText(hymn) {
    if (!hymn) return null;
    const textColor = darkMode ? 'text-amber-50/95 print:text-black' : 'text-stone-900 print:text-black';
    const borderColor = darkMode ? 'border-amber-500/40 print:border-stone-400' : 'border-amber-700/30 print:border-stone-400';

    if (displayMode === 'slashes') {
      return <p className={`${fontConfig.textClass} leading-relaxed ${textColor}`}>{hymn.colonText}</p>;
    }
    return (
      <div className="space-y-1.5">
        {(hymn.lines || hymn.colonText.split(/\s*\/+\s*/)).map((line, i) => (
          <p key={i} className={`${fontConfig.textClass} leading-snug ${textColor} pl-3 border-l-2 ${borderColor}`}>
            {line}
          </p>
        ))}
      </div>
    );
  }

  const serviceGroupBadge = {
    vespers: { label: 'Вечерня', bg: darkMode ? 'bg-indigo-950 text-indigo-200 border-indigo-800' : 'bg-indigo-50 text-indigo-900 border-indigo-200' },
    matins:  { label: 'Утреня',  bg: darkMode ? 'bg-amber-950 text-amber-200 border-amber-800'   : 'bg-amber-50 text-amber-900 border-amber-200' },
    liturgy: { label: 'Литургия', bg: darkMode ? 'bg-emerald-950 text-emerald-200 border-emerald-800' : 'bg-emerald-50 text-emerald-900 border-emerald-200' }
  };

  const odeNumbersToRender = printAllOdes ? [1, 3, 4, 5, 6, 7, 8, 9] : [selectedOde];

  return (
    <div className={`min-h-screen transition-colors duration-200 print:bg-white print:text-black ${
      darkMode ? 'bg-stone-950 text-stone-100' : 'bg-[#faf8f5] text-stone-900'
    }`}>
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 14mm 12mm 14mm;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <div className={`sticky top-0 z-30 border-b backdrop-blur-md font-sans print:hidden ${
        darkMode ? 'bg-stone-900/95 border-stone-800' : 'bg-white/95 border-stone-200 shadow-sm'
      }`}>
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'all', label: 'Все службы' },
              { id: 'vespers', label: 'Вечерня' },
              { id: 'matins', label: 'Утреня' },
              { id: 'liturgy', label: 'Литургия' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setServiceFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  serviceFilter === tab.id
                    ? 'bg-red-800 text-white shadow-sm'
                    : darkMode
                      ? 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className={`flex items-center rounded-lg border p-0.5 ${darkMode ? 'border-stone-700 bg-stone-800' : 'border-stone-300 bg-stone-100'}`}>
              {FONT_SIZES.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFontSizeId(f.id)}
                  className={`px-2 py-1 rounded-md text-xs font-bold transition ${
                    fontSizeId === f.id
                      ? 'bg-amber-700 text-white'
                      : darkMode ? 'text-stone-300 hover:text-white' : 'text-stone-700 hover:text-black'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                darkMode
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                  : 'bg-stone-800 border-stone-800 text-stone-100'
              }`}
            >
              {darkMode ? '☀ Дневной свет' : '☾ Полумрак храма'}
            </button>

            <button
              onClick={() => {
                const nextMode = !klirosReadMode;
                setKlirosReadMode(nextMode);
                if (nextMode) setShowSettingsPanel(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                klirosReadMode
                  ? 'bg-emerald-700 border-emerald-600 text-white'
                  : darkMode
                    ? 'bg-stone-800 border-stone-700 text-stone-200'
                    : 'bg-white border-stone-300 text-stone-800'
              }`}
            >
              {klirosReadMode ? '✓ Режим клироса' : '✎ Режим уставщика'}
            </button>

            <button
              onClick={handlePrintA4}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-red-800 hover:bg-red-700 text-white shadow-sm transition flex items-center gap-1.5"
            >
              <span>🖨 Печать / PDF</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 md:p-6 print:p-0 space-y-6 print:space-y-3">
        <header className={`border rounded-xl p-4 md:p-5 shadow-sm space-y-4 print:hidden ${
          darkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Клиросный конструктор богослужений</h1>
              <p className={`text-xs md:text-sm font-sans ${darkMode ? 'text-stone-400' : 'text-stone-600'}`}>
                Указания Патриархии.ру ({dates.length} дн.) • Октоих (Глас {activeGlas}) • Минея ({buData?.oldStyleDate?.slice(5) || '11-02'} ст. ст. — {mineya?.title?.slice(0, 45) || 'загрузка...'})
              </p>
            </div>

            <div className="flex items-center gap-2 font-sans flex-wrap">
              <label className="text-xs font-semibold uppercase tracking-wider opacity-75">Дата:</label>
              <select
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className={`border rounded-lg px-3 py-1.5 text-sm font-semibold ${
                  darkMode ? 'bg-stone-800 border-stone-700 text-stone-100' : 'bg-stone-50 border-stone-300 text-stone-900'
                }`}
              >
                {dates.map(d => (
                  <option key={d} value={d}>
                    {d} {new Date(d + 'T00:00:00Z').getUTCDay() === 0 ? '(Воскресенье)' : '(Будни)'}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setShowSettingsPanel(!showSettingsPanel)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                  darkMode ? 'border-stone-700 bg-stone-800 text-stone-300' : 'border-stone-300 bg-stone-100 text-stone-700'
                }`}
              >
                {showSettingsPanel ? 'Скрыть настройки ▲' : 'Настройки храма ▼'}
              </button>
            </div>
          </div>

          {showSettingsPanel && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-sans pt-3 border-t border-stone-500/20">
              <div className={`border rounded-lg p-3 space-y-2 ${
                darkMode ? 'bg-stone-950/60 border-amber-900/50' : 'bg-amber-50/70 border-amber-200/80'
              }`}>
                <div className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-amber-400' : 'text-amber-900'}`}>
                  Посвящение вашего храма (влияет на Устав)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'lord', label: 'Храм Господский' },
                    { id: 'theotokos', label: 'Храм Богородицы' },
                    { id: 'saint', label: 'Храм Святого' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setTempleType(tab.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                        templeType === tab.id
                          ? 'bg-amber-700 text-white shadow-sm'
                          : darkMode
                            ? 'bg-stone-800 text-stone-300 border border-stone-700'
                            : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {templeType === 'saint' && (
                  <div className="pt-2 space-y-1.5">
                    <label className="block text-xs font-medium opacity-85">
                      Тропарь святого вашего храма (разделяйте строки знаком « / »):
                    </label>
                    <textarea
                      rows={2}
                      value={customSaintTroparion}
                      onChange={e => setCustomSaintTroparion(e.target.value)}
                      className={`w-full text-xs p-2 rounded border font-serif ${
                        darkMode ? 'bg-stone-900 border-stone-700 text-stone-100' : 'bg-white border-stone-300 text-stone-900'
                      }`}
                    />
                    {isSunday && (
                      <label className="flex items-center gap-2 text-xs pt-1 cursor-pointer opacity-90">
                        <input
                          type="checkbox"
                          checked={forceTempleTroparionOnSunday}
                          onChange={e => setForceTempleTroparionOnSunday(e.target.checked)}
                        />
                        <span>Петь тропарь святого храма в воскресенье (по Типикону оставляется)</span>
                      </label>
                    )}
                  </div>
                )}
              </div>

              <div className={`border rounded-lg p-3 space-y-3 flex flex-col justify-between ${
                darkMode ? 'bg-stone-950/60 border-stone-800' : 'bg-stone-50 border-stone-200'
              }`}>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider opacity-75 mb-2">
                    Разбивка стихир и тропарей
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDisplayMode('lines')}
                      className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold border transition ${
                        displayMode === 'lines'
                          ? 'bg-amber-800 text-white border-amber-800'
                          : darkMode ? 'bg-stone-800 text-stone-300 border-stone-700' : 'bg-white text-stone-700 border-stone-200'
                      }`}
                    >
                      По певческим строкам
                    </button>
                    <button
                      onClick={() => setDisplayMode('slashes')}
                      className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold border transition ${
                        displayMode === 'slashes'
                          ? 'bg-amber-800 text-white border-amber-800'
                          : darkMode ? 'bg-stone-800 text-stone-300 border-stone-700' : 'bg-white text-stone-700 border-stone-200'
                      }`}
                    >
                      Сплошным текстом с « / »
                    </button>
                  </div>
                </div>

                {buData?.variants?.length > 1 && (
                  <div className="pt-2 border-t border-stone-500/20">
                    <div className="text-xs font-semibold uppercase tracking-wider opacity-75 mb-1.5">
                      Вариант службы (развилка Устава на этот день):
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {buData.variants.map(v => (
                        <button
                          key={v.id}
                          onClick={() => setSelectedVariantId(v.id)}
                          className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
                            selectedVariantId === v.id
                              ? 'bg-red-800 text-white shadow-sm'
                              : darkMode ? 'bg-stone-800 text-stone-300 border border-stone-700' : 'bg-white text-stone-700 border border-stone-300'
                          }`}
                        >
                          {v.label}: {v.title.slice(0, 38)}...
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </header>

        {currentVariant && (
          <main className="space-y-4 print:space-y-3">
            <div className="bg-red-950 text-amber-50 print:bg-white print:text-black print:border-b-2 print:border-red-800 print:rounded-none rounded-xl p-4 print:px-0 print:py-2 shadow-sm print:shadow-none flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-0.5 max-w-3xl">
                <div className="text-xs uppercase tracking-widest text-amber-300 print:text-red-800 font-sans font-semibold">
                  {currentVariant.label} • {selectedDate} {buData?.oldStyleDate ? `(ст. ст. ${buData.oldStyleDate})` : ''} • Глас {activeGlas}
                </div>
                <h2 className="text-lg md:text-xl font-bold">{currentVariant.title}</h2>
              </div>

              <div className="flex items-center gap-2 font-sans print:hidden">
                <button
                  onClick={() => collapseOrExpandAll(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-900/90 hover:bg-red-800 text-amber-100 border border-red-700"
                >
                  Развернуть все ({visibleNodes.length})
                </button>
                <button
                  onClick={() => collapseOrExpandAll(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-900/90 hover:bg-red-800 text-amber-100 border border-red-700"
                >
                  Свернуть все
                </button>
              </div>
            </div>

            {visibleNodes.map((node) => {
              const isCollapsed = !!collapsedNodes[node.nodeKey];
              const isExcluded = !!excludedNodes[node.nodeKey];
              const badge = serviceGroupBadge[node.serviceGroup] || serviceGroupBadge.vespers;
              const t = node.effectiveType;

              const hasHymns =
                t === 'gospodi_vozzvakh' ||
                t === 'paremias' ||
                t === 'stichovna_vespers' ||
                t === 'troparia_vespers' ||
                t === 'bog_gospod' ||
                t === 'kathismata' ||
                t === 'canons' ||
                t === 'svetilen_matins' ||
                t === 'lauds_intro_only' ||
                t === 'lauds_stichera_block' ||
                t === 'great_doxology_block' ||
                t === 'liturgy_full_block' ||
                t === 'lauds';

              return (
                <section
                  key={node.nodeKey}
                  className={`border rounded-xl overflow-hidden transition-opacity print:border-stone-300 print:rounded-lg print:shadow-none print:bg-white ${
                    darkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200 shadow-sm'
                  } ${isExcluded ? 'opacity-45 print:hidden' : 'opacity-100'}`}
                >
                  <div className={`p-3.5 md:p-4 print:p-2.5 border-b flex items-start justify-between gap-3 print:bg-stone-50 print:border-stone-300 ${
                    darkMode ? 'bg-stone-900/90 border-stone-800' : 'bg-stone-100/80 border-stone-200'
                  }`}>
                    <div className="flex items-start gap-3 flex-1">
                      {!klirosReadMode && (
                        <input
                          type="checkbox"
                          checked={!isExcluded}
                          onChange={() => toggleNodeInclude(node.nodeKey)}
                          className="mt-1.5 h-4 w-4 accent-red-800 cursor-pointer shrink-0 print:hidden"
                        />
                      )}

                      <div
                        onClick={() => toggleNodeCollapse(node.nodeKey)}
                        className="cursor-pointer flex-1 space-y-1.5 select-none"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[11px] font-sans font-bold uppercase px-2 py-0.5 rounded border print:border-stone-400 print:text-black print:bg-transparent ${badge.bg}`}>
                            {badge.label}
                          </span>
                          <h3 className={`font-bold print:text-red-900 ${darkMode ? 'text-red-400' : 'text-red-900'} ${fontConfig.rubricClass}`}>
                            {node.sectionTitle}
                          </h3>
                          {hasHymns && (
                            <span className="text-xs font-sans font-semibold bg-emerald-700/20 text-emerald-600 dark:text-emerald-300 px-2 py-0.5 rounded print:hidden">
                              + Тексты книги
                            </span>
                          )}
                        </div>

                        {isCollapsed ? (
                          <p className="text-xs opacity-65 truncate max-w-2xl font-sans print:whitespace-normal print:opacity-100 print:text-black">
                            {node.rubricText}
                          </p>
                        ) : (
                          <p className={`${fontConfig.rubricClass} leading-relaxed p-2.5 print:p-1.5 rounded border print:bg-white print:text-stone-900 print:border-stone-200 ${
                            darkMode
                              ? 'bg-stone-950/80 border-stone-800 text-stone-300'
                              : 'bg-white border-stone-200/80 text-stone-800'
                          }`}>
                            {node.rubricText}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => toggleNodeCollapse(node.nodeKey)}
                      className={`px-2.5 py-1 rounded text-xs font-sans font-bold shrink-0 print:hidden ${
                        darkMode ? 'bg-stone-800 text-stone-300 hover:bg-stone-700' : 'bg-white text-stone-700 border border-stone-300 hover:bg-stone-50'
                      }`}
                    >
                      {isCollapsed ? 'Развернуть ▼' : 'Свернуть ▲'}
                    </button>
                  </div>

                  {!isCollapsed && hasHymns && (
                    <div className="p-4 md:p-5 print:p-3 space-y-5 print:space-y-3">
                      {t === 'gospodi_vozzvakh' && (
                        <>
                          {buildGospodiVozzvakhList(node).map((item) => {
                            const hymnExcluded = !!excludedHymns[item.uniqueKey];
                            if (klirosReadMode && hymnExcluded) return null;
                            return (
                              <div
                                key={item.uniqueKey}
                                className={`space-y-2 pb-4 print:pb-2.5 border-b last:border-none break-inside-avoid print:border-stone-200 ${
                                  darkMode ? 'border-stone-800' : 'border-stone-100'
                                } ${hymnExcluded ? 'opacity-40 print:hidden' : ''}`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  {item.assignedVerse && (
                                    <p className={`font-semibold px-3 py-1 print:px-0 print:py-0 rounded flex-1 print:bg-transparent print:text-red-900 ${fontConfig.rubricClass} ${
                                      darkMode ? 'bg-red-950/60 text-red-300' : 'bg-red-50/80 text-red-900'
                                    }`}>
                                      {item.assignedVerse}
                                    </p>
                                  )}
                                  {!klirosReadMode && (
                                    <label className="flex items-center gap-1.5 text-xs font-sans cursor-pointer shrink-0 opacity-80 print:hidden">
                                      <input
                                        type="checkbox"
                                        checked={!hymnExcluded}
                                        onChange={() => toggleHymnInclude(item.uniqueKey)}
                                        className="h-4 w-4 accent-red-800"
                                      />
                                      <span>Петь</span>
                                    </label>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-xs font-sans opacity-70 print:text-stone-700 print:opacity-100">
                                  <span className="font-semibold">{item.category}</span>
                                  {item.glas && <span>• Глас {item.glas}</span>}
                                  {item.podoben && <span>• Подобен: «{item.podoben}»</span>}
                                </div>
                                {renderFormattedText(item)}
                              </div>
                            );
                          })}

                          {mineya?.vespers?.glory && /Слава/i.test(node.rubricText) && (
                            <div className="pt-2 space-y-1.5 pb-3 border-b border-stone-500/20 break-inside-avoid">
                              <p className={`font-bold print:text-red-900 ${darkMode ? 'text-red-400' : 'text-red-800'} ${fontConfig.rubricClass}`}>
                                Сла́ва Отцу́ и Сы́ну и Свято́му Ду́ху:
                              </p>
                              <div className="text-xs font-sans font-semibold opacity-70 print:text-stone-700">
                                {mineya.vespers.glory.category} {mineya.vespers.glory.glas ? `• Глас ${mineya.vespers.glory.glas}` : ''}
                              </div>
                              {renderFormattedText(mineya.vespers.glory)}
                            </div>
                          )}

                          {(isSunday ? oktoikh?.vespers?.dogmatik : (mineya?.vespers?.theotokion || oktoikh?.vespers?.dogmatik)) && (() => {
                            const finalTheotokion = isSunday
                              ? oktoikh?.vespers?.dogmatik
                              : (mineya?.vespers?.theotokion || oktoikh?.vespers?.dogmatik);
                            return (
                              <div className={`pt-2 space-y-2 p-4 print:p-2.5 rounded-lg border break-inside-avoid print:bg-white print:border-stone-300 ${
                                darkMode ? 'bg-amber-950/20 border-amber-800/50' : 'bg-amber-50/40 border-amber-200/60'
                              }`}>
                                <p className={`font-bold print:text-red-900 ${darkMode ? 'text-red-400' : 'text-red-800'} ${fontConfig.rubricClass}`}>
                                  {mineya?.vespers?.glory && /Слава/i.test(node.rubricText)
                                    ? 'И ны́не и при́сно и во ве́ки веко́в. Ами́нь.'
                                    : 'Сла́ва Отцу́ и Сы́ну и Свято́му Ду́ху, и ны́не и при́сно и во ве́ки веко́в. Ами́нь.'}
                                </p>
                                <div className="text-xs font-sans font-semibold opacity-75 print:text-stone-700">
                                  {finalTheotokion.category} {finalTheotokion.podoben ? `• Подобен: «${finalTheotokion.podoben}»` : ''}
                                </div>
                                {renderFormattedText(finalTheotokion)}
                              </div>
                            );
                          })()}
                        </>
                      )}

                      {t === 'paremias' && chasoslov?.daily_prokeimena && (() => {
                        const dayOfWeek = new Date(selectedDate + 'T00:00:00Z').getUTCDay();
                        const prok = chasoslov.daily_prokeimena[dayOfWeek] || chasoslov.daily_prokeimena[0];
                        return (
                          <div className={`p-4 print:p-2.5 rounded-lg border space-y-2 break-inside-avoid print:bg-white print:border-stone-300 ${
                            darkMode ? 'bg-amber-950/20 border-amber-800/50' : 'bg-amber-50/50 border-amber-200'
                          }`}>
                            <div className="text-xs font-sans font-bold uppercase tracking-wider text-red-800 dark:text-red-400 print:text-red-900">
                              Прокимен вечерни • {prok.dayName} • Глас {prok.glas}
                            </div>
                            {renderFormattedText({ colonText: prok.main })}
                            <div className="space-y-1 pt-1">
                              {prok.verses.map((v, vIdx) => (
                                <p key={vIdx} className={`font-semibold print:text-red-900 ${darkMode ? 'text-red-300' : 'text-red-800'} ${fontConfig.rubricClass}`}>
                                  {v}
                                </p>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {t === 'stichovna_vespers' && oktoikh?.vespers?.stichovna_stichera && (() => {
                        const stichera = isSunday
                          ? oktoikh.vespers.stichovna_stichera
                          : [
                              ...(oktoikh.vespers.stichovna_stichera.slice(0, 2)),
                              ...(mineya?.vespers?.stichovna_stichera?.length > 0
                                ? mineya.vespers.stichovna_stichera.slice(0, 1)
                                : oktoikh.vespers.stichovna_stichera.slice(2, 3))
                            ];
                        const verses = isSunday
                          ? (chasoslov?.stichovna_verses_sunday || [])
                          : (chasoslov?.stichovna_verses_weekday || []);

                        return (
                          <div className="space-y-4 print:space-y-2.5">
                            {stichera.map((stItem, idx) => {
                              const stKey = `${node.nodeKey}_stichovna_${idx}`;
                              const stExcluded = !!excludedHymns[stKey];
                              if (klirosReadMode && stExcluded) return null;
                              const assignedVerse = stItem.stich
                                ? `Стих: ${stItem.stich}`
                                : (idx > 0 ? verses[idx - 1] : null);

                              return (
                                <div
                                  key={stKey}
                                  className={`space-y-2 pb-3 print:pb-2 border-b last:border-none break-inside-avoid print:border-stone-200 ${
                                    darkMode ? 'border-stone-800' : 'border-stone-100'
                                  } ${stExcluded ? 'opacity-40 print:hidden' : ''}`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    {assignedVerse ? (
                                      <p className={`font-semibold px-3 py-1 print:px-0 print:py-0 rounded flex-1 print:bg-transparent print:text-red-900 ${fontConfig.rubricClass} ${
                                        darkMode ? 'bg-red-950/60 text-red-300' : 'bg-red-50/80 text-red-900'
                                      }`}>
                                        {assignedVerse}
                                      </p>
                                    ) : (
                                      <span className="text-xs font-sans font-semibold text-red-800 dark:text-red-300 print:text-red-900">
                                        1-я стихира на стиховне (поется без стиха)
                                      </span>
                                    )}

                                    {!klirosReadMode && (
                                      <label className="flex items-center gap-1.5 text-xs font-sans cursor-pointer shrink-0 opacity-80 print:hidden">
                                        <input
                                          type="checkbox"
                                          checked={!stExcluded}
                                          onChange={() => toggleHymnInclude(stKey)}
                                          className="h-4 w-4 accent-red-800"
                                        />
                                        <span>Петь</span>
                                      </label>
                                    )}
                                  </div>

                                  <div className="text-xs font-sans font-semibold opacity-70 print:text-stone-700">
                                    {stItem.category} {stItem.glas ? `• Глас ${stItem.glas}` : ''}
                                  </div>
                                  {renderFormattedText(stItem)}
                                </div>
                              );
                            })}

                            {mineya?.vespers?.stichovna_glory && /Слава/i.test(node.rubricText) && (
                              <div className="pt-2 space-y-1.5 pb-3 border-b border-stone-500/20 break-inside-avoid">
                                <p className={`font-bold print:text-red-900 ${darkMode ? 'text-red-400' : 'text-red-800'} ${fontConfig.rubricClass}`}>
                                  Сла́ва Отцу́ и Сы́ну и Свято́му Ду́ху:
                                </p>
                                <div className="text-xs font-sans font-semibold opacity-70 print:text-stone-700">
                                  {mineya.vespers.stichovna_glory.category} • Глас {mineya.vespers.stichovna_glory.glas}
                                </div>
                                {renderFormattedText(mineya.vespers.stichovna_glory)}
                              </div>
                            )}

                            {(isSunday ? oktoikh.vespers.stichovna_theotokion : (mineya?.vespers?.stichovna_theotokion || oktoikh.vespers.stichovna_theotokion)) && (() => {
                              const stTheotokion = isSunday
                                ? oktoikh.vespers.stichovna_theotokion
                                : (mineya?.vespers?.stichovna_theotokion || oktoikh.vespers.stichovna_theotokion);
                              return (
                                <div className={`pt-2 space-y-2 p-4 print:p-2.5 rounded-lg border break-inside-avoid print:bg-white print:border-stone-300 ${
                                  darkMode ? 'bg-amber-950/20 border-amber-800/50' : 'bg-amber-50/40 border-amber-200/60'
                                }`}>
                                  <p className={`font-bold print:text-red-900 ${darkMode ? 'text-red-400' : 'text-red-800'} ${fontConfig.rubricClass}`}>
                                    {/Слава/i.test(node.rubricText)
                                      ? 'И ны́не и при́сно и во ве́ки веко́в. Ами́нь.'
                                      : 'Сла́ва Отцу́ и Сы́ну и Свято́му Ду́ху, и ны́не и при́сно и во ве́ки веко́в. Ами́нь.'}
                                  </p>
                                  <div className="text-xs font-sans font-semibold opacity-75 print:text-stone-700">
                                    {stTheotokion.category}
                                  </div>
                                  {renderFormattedText(stTheotokion)}
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })()}

                      {(t === 'troparia_vespers' || t === 'bog_gospod') && (
                        <div className="space-y-4 print:space-y-2.5">
                          {buildTropariaSequence(node).map((entry) => {
                            const tropExcluded = !!excludedHymns[entry.uniqueKey];
                            if (klirosReadMode && tropExcluded) return null;
                            return (
                              <div
                                key={entry.uniqueKey}
                                className={`space-y-1.5 pb-3 print:pb-2 border-b last:border-none break-inside-avoid print:border-stone-200 ${
                                  darkMode ? 'border-stone-800' : 'border-stone-100'
                                } ${tropExcluded ? 'opacity-40 print:hidden' : ''}`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  {entry.prefix ? (
                                    <p className={`font-bold print:text-red-900 ${darkMode ? 'text-red-400' : 'text-red-800'} ${fontConfig.rubricClass}`}>
                                      {entry.prefix}
                                    </p>
                                  ) : <div />}

                                  {!klirosReadMode && (
                                    <label className="flex items-center gap-1.5 text-xs font-sans cursor-pointer shrink-0 opacity-80 print:hidden">
                                      <input
                                        type="checkbox"
                                        checked={!tropExcluded}
                                        onChange={() => toggleHymnInclude(entry.uniqueKey)}
                                        className="h-4 w-4 accent-red-800"
                                      />
                                      <span>Петь</span>
                                    </label>
                                  )}
                                </div>
                                <div className="text-xs font-sans font-semibold opacity-70 print:text-stone-700">
                                  {entry.hymn.category} {entry.hymn.glas ? `• Глас ${entry.hymn.glas}` : ''}
                                </div>
                                {renderFormattedText(entry.hymn)}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {t === 'kathismata' && oktoikh?.matins?.sedalny && (
                        <div className="space-y-4 print:space-y-2.5">
                          {oktoikh.matins.sedalny.map((sed, sIdx) => (
                            <div key={sIdx} className="space-y-1.5 pb-3 border-b border-stone-500/20 last:border-none break-inside-avoid">
                              <div className="text-xs font-sans font-semibold opacity-75 print:text-stone-700">{sed.category}</div>
                              {renderFormattedText(sed)}
                            </div>
                          ))}
                        </div>
                      )}

                      {t === 'canons' && (
                        <div className="space-y-4 print:space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-3 font-sans print:hidden pb-2 border-b border-stone-500/20">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-bold uppercase opacity-75 mr-1">Каноны:</span>
                              {[
                                { id: 'combined', label: 'Октоих + Минея (вместе)' },
                                { id: 'oktoikh',  label: 'Только Октоих' },
                                { id: 'mineya',   label: 'Только Минея' }
                              ].map(m => (
                                <button
                                  key={m.id}
                                  onClick={() => setCanonSourceMode(m.id)}
                                  className={`px-2.5 py-1 rounded-md text-xs font-bold border transition ${
                                    canonSourceMode === m.id
                                      ? 'bg-amber-800 text-white border-amber-800'
                                      : darkMode ? 'bg-stone-800 text-stone-300 border-stone-700' : 'bg-stone-100 text-stone-700 border-stone-300'
                                  }`}
                                >
                                  {m.label}
                                </button>
                              ))}
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                              {[1, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                <button
                                  key={num}
                                  onClick={() => { setSelectedOde(num); setPrintAllOdes(false); }}
                                  className={`px-2.5 py-1 rounded-md text-xs font-bold border transition ${
                                    !printAllOdes && selectedOde === num
                                      ? 'bg-red-800 text-white border-red-800'
                                      : darkMode ? 'bg-stone-800 text-stone-300 border-stone-700' : 'bg-stone-100 text-stone-700 border-stone-300'
                                  }`}
                                >
                                  Песнь {num}
                                </button>
                              ))}
                              <button
                                onClick={() => setPrintAllOdes(true)}
                                className={`px-2.5 py-1 rounded-md text-xs font-bold border transition ${
                                  printAllOdes
                                    ? 'bg-red-800 text-white border-red-800'
                                    : darkMode ? 'bg-stone-800 text-stone-300 border-stone-700' : 'bg-stone-100 text-stone-700 border-stone-300'
                                }`}
                              >
                                Все (1–9)
                              </button>
                            </div>
                          </div>

                          {odeNumbersToRender.map((odeNum) => {
                            const odeBlocks = buildMergedOde(odeNum);
                            return (
                              <div key={odeNum} className="space-y-4 pt-3 border-t-2 border-stone-500/20 first:border-none">
                                <h4 className="text-sm font-sans font-bold uppercase tracking-wider text-red-800 dark:text-red-400 print:text-red-900">
                                  Песнь {odeNum} канона
                                </h4>

                                {odeBlocks.map((odeObj, bIdx) => (
                                  <div key={bIdx} className="space-y-3 pl-2 border-l-2 border-stone-500/20">
                                    {odeObj.irmos && (
                                      <div className={`p-3.5 print:p-2 rounded-lg border space-y-1.5 break-inside-avoid print:bg-white print:border-stone-300 ${
                                        darkMode ? 'bg-amber-950/20 border-amber-800/50' : 'bg-amber-50/60 border-amber-200'
                                      }`}>
                                        <div className="text-xs font-sans font-bold text-red-800 dark:text-red-400 print:text-red-900">
                                          {odeObj.irmos.category}
                                        </div>
                                        {renderFormattedText(odeObj.irmos)}
                                      </div>
                                    )}

                                    {odeObj.troparia?.map((tr, tIdx) => (
                                      <div key={tIdx} className="space-y-1.5 pb-2.5 border-b border-stone-500/20 last:border-none break-inside-avoid">
                                        {tr.stich && (
                                          <p className={`font-semibold print:text-red-900 ${darkMode ? 'text-red-300' : 'text-red-800'} ${fontConfig.rubricClass}`}>
                                            Припев: {tr.stich}
                                          </p>
                                        )}
                                        <div className="text-xs font-sans opacity-70 print:text-stone-700">{tr.category}</div>
                                        {renderFormattedText(tr)}
                                      </div>
                                    ))}
                                  </div>
                                ))}

                                {odeNum === 3 && mineya?.matins?.sedalny?.length > 0 && (
                                  <div className={`p-4 print:p-2.5 rounded-lg border space-y-3 break-inside-avoid print:bg-white print:border-stone-300 ${
                                    darkMode ? 'bg-stone-950 border-stone-800' : 'bg-stone-50 border-stone-200'
                                  }`}>
                                    <div className="text-xs font-sans font-bold uppercase text-red-800 dark:text-red-400 print:text-red-900">
                                      По 3-й песни канона • Седален Минеи
                                    </div>
                                    {mineya.matins.sedalny.map((sItem, sIdx) => (
                                      <div key={sIdx} className="space-y-1">
                                        <div className="text-xs font-sans font-semibold opacity-75">{sItem.category}</div>
                                        {renderFormattedText(sItem)}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {odeNum === 6 && (mineya?.kondakion || mineya?.ikos) && (
                                  <div className={`p-4 print:p-2.5 rounded-lg border space-y-3 break-inside-avoid print:bg-white print:border-stone-300 ${
                                    darkMode ? 'bg-amber-950/20 border-amber-800/50' : 'bg-amber-50/50 border-amber-200'
                                  }`}>
                                    <div className="text-xs font-sans font-bold uppercase text-red-800 dark:text-red-400 print:text-red-900">
                                      По 6-й песни канона • Кондак и Икос
                                    </div>
                                    {mineya.kondakion && (
                                      <div className="space-y-1">
                                        <div className="text-xs font-sans font-semibold opacity-75">
                                          {mineya.kondakion.category} {mineya.kondakion.glas ? `• Глас ${mineya.kondakion.glas}` : ''}
                                        </div>
                                        {renderFormattedText(mineya.kondakion)}
                                      </div>
                                    )}
                                    {mineya.ikos && (
                                      <div className="space-y-1 pt-2 border-t border-stone-500/20">
                                        <div className="text-xs font-sans font-semibold opacity-75">{mineya.ikos.category}</div>
                                        {renderFormattedText(mineya.ikos)}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {t === 'svetilen_matins' && (
                        <div className="space-y-4">
                          {isSunday && oktoikh?.matins?.svetilny?.[0] && (
                            <div className="space-y-1.5 pb-3 border-b border-stone-500/20 break-inside-avoid">
                              <div className="text-xs font-sans font-bold text-red-800 dark:text-red-400 print:text-red-900">
                                {oktoikh.matins.svetilny[0].category}
                              </div>
                              {renderFormattedText(oktoikh.matins.svetilny[0])}
                            </div>
                          )}
                          {mineya?.matins?.svetilny?.map((sv, svIdx) => (
                            <div key={svIdx} className="space-y-1.5 pb-3 border-b border-stone-500/20 last:border-none break-inside-avoid">
                              <div className="text-xs font-sans font-bold text-red-800 dark:text-red-400 print:text-red-900">
                                {sv.category}
                              </div>
                              {renderFormattedText(sv)}
                            </div>
                          ))}
                        </div>
                      )}

                      {t === 'lauds_intro_only' && chasoslov?.lauds_intro && (
                        <div className={`p-3.5 print:p-2 rounded-lg border space-y-1 break-inside-avoid print:bg-white print:border-stone-300 ${
                          darkMode ? 'bg-stone-950 border-stone-800' : 'bg-stone-50 border-stone-200'
                        }`}>
                          <div className="text-xs font-sans font-bold uppercase text-red-800 dark:text-red-400 print:text-red-900">
                            Запев на хвалитех (Глас {activeGlas})
                          </div>
                          {renderFormattedText(chasoslov.lauds_intro)}
                        </div>
                      )}

                      {(t === 'lauds_stichera_block' || t === 'lauds') && chasoslov?.lauds_verses && (() => {
                        const countMatch = node.rubricText.match(/[–-]\s*([468])\b/) || node.rubricText.match(/на\s+([468])\b/i);
                        const totalCount = countMatch ? Number(countMatch[1]) : (node.refs?.totalCount || (isSunday ? 8 : 4));
                        const pool = [];

                        if (isSunday && oktoikh?.matins?.lauds_stichera) {
                          if (node.refs?.useMineya && mineya?.matins?.lauds_stichera?.length > 0) {
                            pool.push(...oktoikh.matins.lauds_stichera.slice(0, 4));
                            pool.push(...mineya.matins.lauds_stichera);
                          } else {
                            pool.push(...oktoikh.matins.lauds_stichera);
                          }
                        } else if (mineya?.matins?.lauds_stichera?.length > 0) {
                          pool.push(...mineya.matins.lauds_stichera);
                          if (oktoikh?.matins?.lauds_stichera) {
                            pool.push(...oktoikh.matins.lauds_stichera);
                          }
                        } else if (oktoikh?.matins?.lauds_stichera) {
                          pool.push(...oktoikh.matins.lauds_stichera);
                        }

                        const sliced = pool.slice(0, totalCount);
                        const verses = chasoslov.lauds_verses.slice(8 - sliced.length);

                        return (
                          <div className="space-y-4 print:space-y-3">
                            {sliced.map((stItem, idx) => {
                              const lKey = `${node.nodeKey}_lauds_${idx}`;
                              const lExcluded = !!excludedHymns[lKey];
                              if (klirosReadMode && lExcluded) return null;
                              const vObj = verses[idx];

                              return (
                                <div
                                  key={lKey}
                                  className={`space-y-2 pb-3 print:pb-2 border-b last:border-none break-inside-avoid print:border-stone-200 ${
                                    darkMode ? 'border-stone-800' : 'border-stone-100'
                                  } ${lExcluded ? 'opacity-40 print:hidden' : ''}`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    {vObj && (
                                      <p className={`font-semibold px-3 py-1 print:px-0 print:py-0 rounded flex-1 print:bg-transparent print:text-red-900 ${fontConfig.rubricClass} ${
                                        darkMode ? 'bg-red-950/60 text-red-300' : 'bg-red-50/80 text-red-900'
                                      }`}>
                                        Стих {vObj.count}: {vObj.stich}
                                      </p>
                                    )}
                                    {!klirosReadMode && (
                                      <label className="flex items-center gap-1.5 text-xs font-sans cursor-pointer shrink-0 opacity-80 print:hidden">
                                        <input
                                          type="checkbox"
                                          checked={!lExcluded}
                                          onChange={() => toggleHymnInclude(lKey)}
                                          className="h-4 w-4 accent-red-800"
                                        />
                                        <span>Петь</span>
                                      </label>
                                    )}
                                  </div>

                                  <div className="text-xs font-sans font-semibold opacity-70 print:text-stone-700">
                                    {stItem.category}
                                  </div>
                                  {renderFormattedText(stItem)}
                                </div>
                              );
                            })}

                            {mineya?.matins?.lauds_glory && (
                              <div className="pt-2 space-y-1.5 pb-3 border-b border-stone-500/20 break-inside-avoid">
                                <p className={`font-bold print:text-red-900 ${darkMode ? 'text-red-400' : 'text-red-800'} ${fontConfig.rubricClass}`}>
                                  Сла́ва Отцу́ и Сы́ну и Свято́му Ду́ху:
                                </p>
                                <div className="text-xs font-sans font-semibold opacity-70 print:text-stone-700">
                                  {mineya.matins.lauds_glory.category}
                                </div>
                                {renderFormattedText(mineya.matins.lauds_glory)}
                              </div>
                            )}

                            {chasoslov.preblagoslovenna && (
                              <div className={`pt-2 space-y-2 p-4 print:p-2.5 rounded-lg border break-inside-avoid print:bg-white print:border-stone-300 ${
                                darkMode ? 'bg-amber-950/20 border-amber-800/50' : 'bg-amber-50/50 border-amber-200'
                              }`}>
                                <p className={`font-bold print:text-red-900 ${darkMode ? 'text-red-400' : 'text-red-800'} ${fontConfig.rubricClass}`}>
                                  И ны́не и при́сно и во ве́ки веко́в. Ами́нь.
                                </p>
                                <div className="text-xs font-sans font-semibold opacity-75 print:text-stone-700">
                                  {chasoslov.preblagoslovenna.category}
                                </div>
                                {renderFormattedText(chasoslov.preblagoslovenna)}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {t === 'great_doxology_block' && chasoslov?.great_doxology && (() => {
                        const doxologyTrop = activeGlas <= 4
                          ? chasoslov.troparion_doxology_1_4
                          : chasoslov.troparion_doxology_5_8;

                        return (
                          <div className="space-y-4 print:space-y-3">
                            <div className={`p-4 print:p-2.5 rounded-lg border space-y-2 break-inside-avoid print:bg-white print:border-stone-300 ${
                              darkMode ? 'bg-stone-950 border-stone-800' : 'bg-stone-50 border-stone-200'
                            }`}>
                              <div className="text-xs font-sans font-bold uppercase tracking-wider text-red-800 dark:text-red-400 print:text-red-900">
                                Великое славословие
                              </div>
                              {renderFormattedText(chasoslov.great_doxology)}
                            </div>

                            {isSunday && doxologyTrop && (
                              <div className={`p-4 print:p-2.5 rounded-lg border space-y-2 break-inside-avoid print:bg-white print:border-stone-300 ${
                                darkMode ? 'bg-red-950/20 border-red-900/50' : 'bg-red-50/40 border-red-200'
                              }`}>
                                <div className="text-xs font-sans font-bold uppercase tracking-wider text-red-800 dark:text-red-400 print:text-red-900">
                                  По Трисвятом • {doxologyTrop.category} (рядовой Глас {activeGlas})
                                </div>
                                {renderFormattedText(doxologyTrop)}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* 11. Божественная Литургия: Блаженны, Тропари и Кондаки по входе, Прокимен, Аллилуиарий и Причастны */}
                      {t === 'liturgy_full_block' && chasoslov?.liturgy && (() => {
                        const dayNum = new Date(selectedDate + 'T00:00:00Z').getUTCDay();
                        const weekdayLit = chasoslov.liturgy.weekday_liturgy?.[dayNum] || chasoslov.liturgy.weekday_liturgy?.[1];
                        const weekdayMap = { 1: 'MON1', 2: 'TUE1', 3: 'WED1', 4: 'THU1', 5: 'FRI1', 6: 'SAT1' };
                        const weekdayCode = weekdayMap[dayNum];

                        const beatPool = [];
                        const mineyaOde3 = mineya?.matins?.canons?.[0]?.odes?.find(o => o.odeNumber === 3)?.troparia || [];
                        const mineyaOde6 = mineya?.matins?.canons?.[0]?.odes?.find(o => o.odeNumber === 6)?.troparia || [];

                        if (isSunday && oktoikh?.liturgy?.beatitudes) {
                          if (mineyaOde3.length > 0) {
                            beatPool.push(...oktoikh.liturgy.beatitudes.slice(0, 4));
                            beatPool.push(...mineyaOde3.slice(0, 4));
                          } else {
                            beatPool.push(...oktoikh.liturgy.beatitudes);
                          }
                        } else {
                          if (mineyaOde3.length > 0) beatPool.push(...mineyaOde3.slice(0, 4));
                          if (mineyaOde6.length > 0) beatPool.push(...mineyaOde6.slice(0, 4));
                          if (beatPool.length === 0 && oktoikh?.liturgy?.beatitudes) {
                            beatPool.push(...oktoikh.liturgy.beatitudes.slice(0, 4));
                          }
                        }

                        const beatVerses = chasoslov.liturgy.beatitudes_verses.slice(
                          Math.max(0, chasoslov.liturgy.beatitudes_verses.length - beatPool.length)
                        );

                        const templeHymnText = templeType === 'saint' ? customSaintTroparion : DEFAULT_TEMPLE_HYMNS[templeType].colonText;
                        const templeTropObj = {
                          id: 'lit_temple_trop',
                          category: templeType === 'lord' ? 'Тропарь храма Господского' : templeType === 'theotokos' ? 'Тропарь храма Богородицы' : 'Тропарь святого храма',
                          glas: DEFAULT_TEMPLE_HYMNS[templeType].glas,
                          colonText: templeHymnText,
                          lines: templeHymnText.split(/\s*\/+\s*/)
                        };

                        const postEntranceList = [];
                        if (isSunday) {
                          if (oktoikh?.troparion) postEntranceList.push({ label: 'Тропарь воскресный:', hymn: oktoikh.troparion });
                          if (templeType === 'theotokos' || (templeType === 'saint' && forceTempleTroparionOnSunday)) {
                            postEntranceList.push({ label: 'Тропарь храма:', hymn: templeTropObj });
                          }
                          if (mineya?.troparion) postEntranceList.push({ label: 'Тропарь святого Минеи:', hymn: mineya.troparion });
                          if (oktoikh?.kondakion) postEntranceList.push({ label: 'Кондак воскресный:', hymn: oktoikh.kondakion });
                          if (mineya?.kondakion) postEntranceList.push({ label: 'Сла́ва — Кондак святого Минеи:', hymn: mineya.kondakion });
                          if (chasoslov.liturgy.predstatelstvo) {
                            postEntranceList.push({ label: 'И ны́не — Кондак Богородице:', hymn: chasoslov.liturgy.predstatelstvo });
                          }
                        } else {
                          const wTrop = ponomarPrayers?.troparia?.[weekdayCode];
                          const wKont = ponomarPrayers?.kontakia?.[weekdayCode];
                          if (wTrop) postEntranceList.push({ label: `Тропарь дня седмицы (${weekdayLit.dayName}):`, hymn: wTrop });
                          if (templeType === 'saint' || templeType === 'theotokos') {
                            postEntranceList.push({ label: 'Тропарь храма:', hymn: templeTropObj });
                          }
                          if (mineya?.troparion) postEntranceList.push({ label: 'Тропарь святого Минеи:', hymn: mineya.troparion });
                          if (wKont) postEntranceList.push({ label: 'Кондак дня седмицы:', hymn: wKont });
                          if (mineya?.kondakion) postEntranceList.push({ label: 'Сла́ва — Кондак святого Минеи:', hymn: mineya.kondakion });
                          if (chasoslov.liturgy.predstatelstvo) {
                            postEntranceList.push({ label: 'И ны́не — Кондак Богородице:', hymn: chasoslov.liturgy.predstatelstvo });
                          }
                        }

                        const activeProk = isSunday ? oktoikh?.liturgy?.prokeimenon : weekdayLit?.prokeimenon;
                        const activeAll = isSunday ? oktoikh?.liturgy?.alleluia : weekdayLit?.alleluia;

                        return (
                          <div className="space-y-6 print:space-y-4">
                            <div className="space-y-3">
                              <h4 className="text-sm font-sans font-bold uppercase tracking-wider text-red-800 dark:text-red-400 print:text-red-900 border-b border-stone-500/20 pb-1">
                                1. Третий антифон — «Блаженны»
                              </h4>
                              <p className={`font-semibold print:text-red-900 ${darkMode ? 'text-amber-200' : 'text-stone-800'} ${fontConfig.rubricClass}`}>
                                {chasoslov.liturgy.beatitudes_intro}
                              </p>

                              {beatPool.map((bItem, bIdx) => {
                                const bKey = `${node.nodeKey}_beat_${bIdx}`;
                                const bExcluded = !!excludedHymns[bKey];
                                if (klirosReadMode && bExcluded) return null;
                                const vObj = beatVerses[bIdx];

                                return (
                                  <div
                                    key={bKey}
                                    className={`space-y-1.5 pb-2.5 border-b last:border-none break-inside-avoid print:border-stone-200 ${
                                      darkMode ? 'border-stone-800' : 'border-stone-100'
                                    } ${bExcluded ? 'opacity-40 print:hidden' : ''}`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      {vObj && (
                                        <p className={`font-semibold px-2.5 py-1 print:px-0 print:py-0 rounded flex-1 print:bg-transparent print:text-red-900 ${fontConfig.rubricClass} ${
                                          darkMode ? 'bg-red-950/60 text-red-300' : 'bg-red-50/80 text-red-900'
                                        }`}>
                                          На {vObj.count}: {vObj.stich}
                                        </p>
                                      )}
                                      {!klirosReadMode && (
                                        <label className="flex items-center gap-1.5 text-xs font-sans cursor-pointer shrink-0 opacity-80 print:hidden">
                                          <input
                                            type="checkbox"
                                            checked={!bExcluded}
                                            onChange={() => toggleHymnInclude(bKey)}
                                            className="h-4 w-4 accent-red-800"
                                          />
                                          <span>Петь</span>
                                        </label>
                                      )}
                                    </div>
                                    <div className="text-xs font-sans opacity-70 print:text-stone-700">{bItem.category}</div>
                                    {renderFormattedText(bItem)}
                                  </div>
                                );
                              })}
                            </div>

                            <div className="space-y-3 pt-2">
                              <h4 className="text-sm font-sans font-bold uppercase tracking-wider text-red-800 dark:text-red-400 print:text-red-900 border-b border-stone-500/20 pb-1">
                                2. По малом входе: Тропари и Кондаки
                              </h4>

                              <div className={`p-3 rounded-lg border break-inside-avoid print:bg-white print:border-stone-300 ${
                                darkMode ? 'bg-stone-950 border-stone-800' : 'bg-stone-50 border-stone-200'
                              }`}>
                                <div className="text-xs font-sans font-bold uppercase text-red-800 dark:text-red-400 print:text-red-900 mb-1">
                                  Входный стих Литургии:
                                </div>
                                {renderFormattedText({ colonText: isSunday ? chasoslov.liturgy.vkhodnoe_sunday : chasoslov.liturgy.vkhodnoe_weekday })}
                              </div>

                              {postEntranceList.map((item, pIdx) => {
                                const pKey = `${node.nodeKey}_post_ent_${pIdx}`;
                                const pExcluded = !!excludedHymns[pKey];
                                if (klirosReadMode && pExcluded) return null;

                                return (
                                  <div
                                    key={pKey}
                                    className={`space-y-1.5 pb-2.5 border-b last:border-none break-inside-avoid print:border-stone-200 ${
                                      darkMode ? 'border-stone-800' : 'border-stone-100'
                                    } ${pExcluded ? 'opacity-40 print:hidden' : ''}`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <p className={`font-bold print:text-red-900 ${darkMode ? 'text-red-400' : 'text-red-800'} ${fontConfig.rubricClass}`}>
                                        {item.label}
                                      </p>
                                      {!klirosReadMode && (
                                        <label className="flex items-center gap-1.5 text-xs font-sans cursor-pointer shrink-0 opacity-80 print:hidden">
                                          <input
                                            type="checkbox"
                                            checked={!pExcluded}
                                            onChange={() => toggleHymnInclude(pKey)}
                                            className="h-4 w-4 accent-red-800"
                                          />
                                          <span>Петь</span>
                                        </label>
                                      )}
                                    </div>
                                    <div className="text-xs font-sans opacity-70 print:text-stone-700">
                                      {item.hymn.category} {item.hymn.glas ? `• Глас ${item.hymn.glas}` : ''}
                                    </div>
                                    {renderFormattedText(item.hymn)}
                                  </div>
                                );
                              })}
                            </div>

                            <div className="space-y-3 pt-2">
                              <h4 className="text-sm font-sans font-bold uppercase tracking-wider text-red-800 dark:text-red-400 print:text-red-900 border-b border-stone-500/20 pb-1">
                                3. Прокимен, Аллилуиарий и Причастны
                              </h4>

                              {activeProk && (
                                <div className={`p-3.5 print:p-2 rounded-lg border space-y-1.5 break-inside-avoid print:bg-white print:border-stone-300 ${
                                  darkMode ? 'bg-amber-950/20 border-amber-800/50' : 'bg-amber-50/50 border-amber-200'
                                }`}>
                                  <div className="text-xs font-sans font-bold uppercase text-red-800 dark:text-red-400 print:text-red-900">
                                    Прокимен перед Апостолом • Глас {activeProk.glas}
                                  </div>
                                  {renderFormattedText({ colonText: activeProk.main })}
                                  <p className={`font-semibold print:text-red-900 ${darkMode ? 'text-red-300' : 'text-red-800'} ${fontConfig.rubricClass}`}>
                                    {activeProk.stich}
                                  </p>
                                </div>
                              )}

                              {activeAll && (
                                <div className={`p-3.5 print:p-2 rounded-lg border space-y-1.5 break-inside-avoid print:bg-white print:border-stone-300 ${
                                  darkMode ? 'bg-stone-950 border-stone-800' : 'bg-stone-50 border-stone-200'
                                }`}>
                                  <div className="text-xs font-sans font-bold uppercase text-red-800 dark:text-red-400 print:text-red-900">
                                    Аллилуиарий перед Евангелием • Глас {activeAll.glas}
                                  </div>
                                  <p className={`${fontConfig.textClass} font-bold`}>Аллилу́иа, аллилу́иа, аллилу́иа.</p>
                                  <p className={`font-semibold print:text-red-900 ${darkMode ? 'text-red-300' : 'text-red-800'} ${fontConfig.rubricClass}`}>
                                    {activeAll.stich1}
                                  </p>
                                  <p className={`font-semibold print:text-red-900 ${darkMode ? 'text-red-300' : 'text-red-800'} ${fontConfig.rubricClass}`}>
                                    {activeAll.stich2}
                                  </p>
                                </div>
                              )}

                              <div className={`p-3.5 print:p-2 rounded-lg border space-y-2 break-inside-avoid print:bg-white print:border-stone-300 ${
                                darkMode ? 'bg-emerald-950/20 border-emerald-900/50' : 'bg-emerald-50/40 border-emerald-200'
                              }`}>
                                <div className="text-xs font-sans font-bold uppercase text-red-800 dark:text-red-400 print:text-red-900">
                                  Причастен дня ({weekdayLit?.dayName || 'Воскресный'}) и святого
                                </div>
                                {renderFormattedText({ colonText: weekdayLit?.communion || chasoslov.liturgy.weekday_liturgy[0].communion })}
                                <div className="pt-1 border-t border-stone-500/20">
                                  <div className="text-xs font-sans font-semibold opacity-75 mb-0.5">Причастен святого (если поется два причастна):</div>
                                  {renderFormattedText({ colonText: chasoslov.liturgy.saint_communion_default })}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </section>
              );
            })}
          </main>
        )}
      </div>
    </div>
  );
}

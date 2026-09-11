// Referentni regresioni testovi prototipa (jsdom).
// Pokretanje iz root-a projekta: npm i jsdom && node referenca-sim.jsdom.js
// 5 scenarija, ~59 provera + fuzz. Služi kao specifikacija ponašanja za vitest testove u Fazi 1.
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');

const HTML = fs.readFileSync('./moja-farma-v3.html', 'utf8');
let PAD = 0, PROSLO = 0;
const greske = [];

function ok(uslov, poruka){
  if(uslov){ PROSLO++; }
  else { PAD++; greske.push('ASSERT: ' + poruka); console.log('  ✗ ' + poruka); }
}

function napraviDom(seedStorage){
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => greske.push('jsdomError: ' + (e && e.stack || e)));
  const dom = new JSDOM(HTML, { runScripts: 'dangerously', virtualConsole: vc,
    beforeParse(w){
      // virtuelni sat
      const stvarno = w.Date.now.bind(w.Date);
      w.__offset = 0;
      w.Date.now = () => stvarno() + w.__offset;
      // tajmeri: interval hvatamo, timeout izvršavamo odmah
      w.__ticks = [];
      w.setInterval = (cb) => { w.__ticks.push(cb); return w.__ticks.length; };
      w.clearInterval = () => {};
      w.setTimeout = (cb) => { try { cb(); } catch(e){ greske.push('timeout: '+(e&&e.stack||e)); } return 1; };
      w.clearTimeout = () => {};
      w.requestAnimationFrame = (cb) => { try { cb(w.performance.now() + 1000); } catch(e){ greske.push('raf: '+(e&&e.stack||e)); } return 1; };
      w.cancelAnimationFrame = () => {};
      w.confirm = () => true;
      // zvuk stub
      w.AudioContext = class {
        constructor(){ this.currentTime = 0; this.state = 'running'; this.destination = {}; }
        resume(){}
        createOscillator(){ return { type:'', frequency:{value:0}, connect(){}, start(){}, stop(){} }; }
        createGain(){ return { gain:{ setValueAtTime(){}, exponentialRampToValueAtTime(){} }, connect(){} }; }
      };
      // window.storage stub
      w.__mem = Object.assign({}, seedStorage || {});
      w.storage = {
        async get(k){ if(!(k in w.__mem)) throw new Error('nema kljuca'); return { key:k, value:w.__mem[k] }; },
        async set(k,v){ w.__mem[k] = v; return { key:k, value:v }; },
      };
    }
  });
  return dom;
}

const cekaj = () => new Promise(r => process.nextTick(() => setImmediate(r)));

function alat(dom){
  const w = dom.window, d = w.document;
  return {
    w, d,
    q: s => d.querySelector(s),
    qa: s => [...d.querySelectorAll(s)],
    klik(el){ if(!el) return false; el.dispatchEvent(new w.MouseEvent('click', {bubbles:true})); return true; },
    tick(n=1){ for(let i=0;i<n;i++) w.__ticks.forEach(cb=>{ try{cb()}catch(e){ greske.push('tick: '+(e&&e.stack||e)); } }); },
    skok(ms){ w.__offset += ms; },
    zatvoriOverlay(){ let br=0; while(this.q('#nivoVeo.otvoren') && br<10){ this.klik(this.q('#nivoOk')); br++; } },
  };
}

(async () => {

  /* ============ TEST 1: osnovni tok nove igre ============ */
  console.log('TEST 1: nova igra — sadnja, zalivanje, žetva, prodaja');
  {
    const dom = napraviDom();
    await cekaj();
    const t = alat(dom);
    t.zatvoriOverlay();

    ok(t.qa('.parcela').length === 3, 'na startu 2 prazne parcele + 1 zaključana');
    ok(t.q('#novac').textContent.trim() === '50', 'početni novac je 50 (dobijeno: '+t.q('#novac').textContent+')');

    // sadnja pšenice
    t.klik(t.qa('.parcela.prazna')[0]);
    ok(t.q('#list.otvoren'), 'donji list za izbor semena se otvara');
    t.klik(t.q('[data-seme="psenica"]'));
    ok(!t.q('#list.otvoren'), 'list se zatvara posle sadnje');
    ok(t.q('.parcela .traka'), 'posađena parcela ima traku napretka');
    ok(t.q('#novac').textContent.trim() === '40', 'novac umanjen za seme (40)');

    // zalivanje
    ok(t.q('.parcela .zalij'), 'ikonica kapljice vidljiva pre zalivanja');
    t.klik(t.q('.parcela[data-i="0"]'));
    ok(t.q('#toast').textContent.includes('Zaliveno'), 'zalivanje daje potvrdu');
    ok(!t.q('.parcela .zalij'), 'kapljica nestaje posle zalivanja');
    t.klik(t.q('.parcela[data-i="0"]'));
    ok(t.q('#toast').textContent.includes('Već'), 'duplo zalivanje blokirano');

    // rast (20s * 0.75 = 15s posle zalivanja)
    t.skok(16000); t.tick();
    ok(t.q('.parcela.zrelo'), 'pšenica zrela posle ubrzanog rasta');
    t.klik(t.q('.parcela.zrelo'));
    ok(!t.q('.parcela.zrelo'), 'žetva prazni parcelu');

    // prodaja
    t.klik(t.q('nav [data-tab="pijaca"]'));
    ok(t.q('[data-prodaj="psenica"]'), 'pšenica na tezgi posle žetve');
    t.klik(t.q('[data-prodaj="psenica"]'));
    const n1 = parseInt(t.q('#novac').textContent.replace(/\D/g,''));
    ok(n1 > 40, 'prodaja povećava novac ('+n1+')');
    ok(!t.q('[data-prodaj="psenica"]'), 'tezga prazna posle prodaje svega');
  }

  /* ============ TEST 2: grind do nivoa 2 + narudžbine ============ */
  console.log('TEST 2: level-up petlja i narudžbine');
  {
    const dom = napraviDom();
    await cekaj();
    const t = alat(dom);
    t.zatvoriOverlay();

    let nivoOverlayVidjen = false;
    for(let c=0; c<22; c++){
      const prazne = t.qa('.parcela.prazna');
      for(const p of prazne){
        t.klik(p);
        const s = t.q('[data-seme="psenica"]:not([disabled])');
        if(s) t.klik(s); else { t.klik(t.q('#veo')); break; }
      }
      t.skok(21000); t.tick();
      const sve = t.q('#uberiSve');
      if(sve) t.klik(sve);
      else { let z; while((z = t.q('.parcela.zrelo'))) t.klik(z); }
      if(t.q('#nivoVeo.otvoren')){ nivoOverlayVidjen = true; t.zatvoriOverlay(); }
      // povremeno prodaj
      if(c % 4 === 3){
        t.klik(t.q('nav [data-tab="pijaca"]'));
        const pr = t.q('[data-prodaj]'); if(pr) t.klik(pr);
        t.klik(t.q('nav [data-tab="farma"]'));
      }
    }
    ok(nivoOverlayVidjen, 'level-up overlay se pojavio tokom grinda');
    ok(parseInt(t.q('#nivoBr').textContent) >= 2, 'dostignut bar nivo 2 (nivo: '+t.q('#nivoBr').textContent+')');

    // narudžbine
    t.klik(t.q('nav [data-tab="narudzbe"]'));
    ok(t.qa('[data-isporuci]').length === 2, 'uvek postoje tačno 2 narudžbine');
    const idPre = t.qa('[data-isporuci]').map(b=>b.dataset.isporuci).join(',');
    t.klik(t.q('[data-odbij]'));
    const idPosle = t.qa('[data-isporuci]').map(b=>b.dataset.isporuci).join(',');
    ok(idPre !== idPosle, 'odbijanje menja narudžbinu');
    ok(t.qa('[data-isporuci]').length === 2, 'posle odbijanja i dalje 2 narudžbine');
    const ids = t.qa('[data-isporuci]').map(b=>b.dataset.isporuci);
    ok(new Set(ids).size === ids.length, 'ID-jevi narudžbina su jedinstveni');
  }

  /* ============ TEST 3: bogat sejv — mašine, životinje, isporuka ============ */
  console.log('TEST 3: mašine, životinje, isporuka narudžbine');
  {
    const sejv = {
      v:3, novac:100000, xp:5000,
      parcele:[{c:null,t:0,z:false},{c:null,t:0,z:false}],
      mag:{psenica:20,sargarepa:10,paprika:9,bundeva:2,grozdje:0,brasno:0,ajvar:0,jaje:0,mleko:0},
      masine:{mlin:{k:false,t:0},kazan:{k:false,t:0}},
      ziv:{kokosinjac:{k:false,t:0},stala:{k:false,t:0}},
      narudzbe:[], mute:true, sadio:true,
      stat:{ubrano:0,zaradjeno:0,isporuke:0},
      poklonDan:'', videno: Date.now()
    };
    const dom = napraviDom({ 'moja-farma-v2': JSON.stringify(sejv) });
    await cekaj();
    const t = alat(dom);
    t.zatvoriOverlay(); // dnevni poklon

    ok(parseInt(t.q('#nivoBr').textContent) >= 5, 'xp 5000 daje bar nivo 5 (nivo: '+t.q('#nivoBr').textContent+')');

    // kupovina svega u radnji
    t.klik(t.q('nav [data-tab="radnja"]'));
    for(const id of ['mlin','kazan','kokosinjac','stala']){
      const b = t.q('[data-kupi="'+id+'"]');
      ok(!!b, 'radnja nudi kupovinu: '+id);
      t.klik(b);
    }
    ok(t.qa('[data-kupi]').length === 0, 'sve zgrade kupljene, nema više dugmadi za kupovinu');

    // farma: mašine rade
    t.klik(t.q('nav [data-tab="farma"]'));
    ok(t.q('[data-masina="kazan"]'), 'kazan kartica na farmi');
    ok(t.q('#scenaKoka').style.display === 'block', 'kokoška se pojavila u sceni');
    ok(t.q('#scenaKrava').style.display === 'block', 'krava se pojavila u sceni');

    t.klik(t.q('[data-kuvaj="kazan"]'));
    ok(t.q('[data-mbar="kazan"]'), 'kazan kuva (traka vidljiva)');
    t.klik(t.q('[data-kuvaj="mlin"]'));
    t.skok(241000); t.tick();
    ok(!t.q('[data-mbar="kazan"]'), 'kazan završio posle 4 min');

    // životinje
    t.skok(9 * 180000); t.tick();
    const pok = t.q('[data-pokupi="kokosinjac"]');
    ok(pok && !pok.disabled, 'jaja spremna za kupljenje');
    t.klik(pok);
    ok(t.q('#toast').textContent.includes('jaja'), 'kupljenje jaja daje potvrdu');
    const pokM = t.q('[data-pokupi="stala"]');
    ok(pokM && !pokM.disabled, 'mleko spremno posle preskoka vremena');
    t.klik(pokM);

    // pijaca sadrži proizvode
    t.klik(t.q('nav [data-tab="pijaca"]'));
    ok(t.q('[data-prodaj="ajvar"]'), 'ajvar na tezgi');
    ok(t.q('[data-prodaj="brasno"]'), 'brašno na tezgi');
    ok(t.q('[data-prodaj="jaje"]'), 'jaja na tezgi');

    // isporuka: odbijaj dok ne dođe isporučiva (mag je bogat)
    t.klik(t.q('nav [data-tab="narudzbe"]'));
    let isporuceno = false;
    for(let i=0; i<25 && !isporuceno; i++){
      const b = t.q('[data-isporuci]:not([disabled])');
      if(b){ t.klik(b); isporuceno = true; t.zatvoriOverlay(); }
      else t.klik(t.q('[data-odbij]'));
    }
    ok(isporuceno, 'narudžbina uspešno isporučena');
    ok(t.qa('[data-isporuci]').length === 2, 'posle isporuke opet 2 narudžbine');

    // statistika zabeležena
    t.klik(t.q('nav [data-tab="radnja"]'));
    ok(t.q('#statKuca').textContent.includes('1') , 'statistika isporuka upisana');

    // perzistencija: sejv postoji i validan je JSON v3
    const sacuvano = JSON.parse(dom.window.__mem['moja-farma-v2']);
    ok(sacuvano.v === 3, 'sejv upisan kao v3');
    ok(sacuvano.masine.kazan.k === true, 'sejv pamti kupljen kazan');
    ok(sacuvano.ziv.kokosinjac.k === true, 'sejv pamti kokošinjac');
  }

  /* ============ TEST 4: migracija starog v2 sejva ============ */
  console.log('TEST 4: migracija v2 → v3 (stari igrači ne gube napredak)');
  {
    const v2 = {
      v:2, novac:777, xp:150,
      parcele:[{c:'paprika',t:Date.now()-60000},{c:null,t:0}],
      mag:{psenica:3,sargarepa:0,paprika:2,bundeva:0,grozdje:1,ajvar:1},
      kazan:true, kazanT:0,
      narudzbe:[
        {id:5, ko:{ime:'Baka Mira',emoji:'👵',boja:'#fff'}, stavke:[{k:'psenica',kom:2}], din:60, xp:5},
        {id:6, ko:{ime:'Piljar Pera',emoji:'🧢',boja:'#fff'}, stavke:[{k:'sargarepa',kom:1}], din:80, xp:6},
      ],
      mute:false, sadio:true, videno: Date.now()
    };
    const dom = napraviDom({ 'moja-farma-v2': JSON.stringify(v2) });
    await cekaj();
    const t = alat(dom);
    t.zatvoriOverlay();

    ok(t.q('#novac').textContent.replace(/\D/g,'') === '777' || parseInt(t.q('#novac').textContent.replace(/\D/g,'')) > 777, 'novac prenet iz v2 (777, ili više uz dnevni poklon)');
    ok(t.q('[data-masina="kazan"]'), 'kazan iz v2 sejva prenet kao vlasništvo');
    ok(t.q('.parcela .traka'), 'zasađena paprika iz v2 i dalje raste');

    // fix kolizije ID-jeva: nova narudžbina ne sme dobiti id 5 ili 6
    t.klik(t.q('nav [data-tab="narudzbe"]'));
    t.klik(t.q('[data-odbij]')); // uklanja jednu, generiše novu
    const ids = t.qa('[data-isporuci]').map(b=>+b.dataset.isporuci);
    ok(new Set(ids).size === ids.length, 'nema kolizije ID-jeva posle migracije (ids: '+ids.join(',')+')');
    ok(Math.max(...ids) >= 7, 'novi ID nastavlja od najvećeg starog (ids: '+ids.join(',')+')');

    const sacuvano = JSON.parse(dom.window.__mem['moja-farma-v2']);
    ok(sacuvano.v === 3, 'v2 sejv pretvoren u v3');
    ok(sacuvano.mag.jaje === 0 && sacuvano.mag.brasno === 0, 'nova polja magacina dodata u migraciji');
  }

  /* ============ TEST 5: zaštita od zaključavanja + fuzz ============ */
  console.log('TEST 5: anti-softlock i fuzz (400 nasumičnih akcija)');
  {
    const sejv = {
      v:3, novac:600, xp:200,
      parcele:[{c:null,t:0,z:false},{c:null,t:0,z:false}],
      mag:{psenica:0,sargarepa:0,paprika:0,bundeva:0,grozdje:0,brasno:0,ajvar:0,jaje:0,mleko:0},
      masine:{mlin:{k:false,t:0},kazan:{k:false,t:0}},
      ziv:{kokosinjac:{k:false,t:0},stala:{k:false,t:0}},
      narudzbe:[], mute:true, sadio:true,
      stat:{ubrano:0,zaradjeno:0,isporuke:0},
      poklonDan: new Date().toLocaleDateString('sv'), videno: Date.now()
    };
    const dom = napraviDom({ 'moja-farma-v2': JSON.stringify(sejv) });
    await cekaj();
    const t = alat(dom);
    t.zatvoriOverlay();

    // 600 din, ništa ne raste, magacin prazan → kupovina kazana (600) mora biti odbijena
    t.klik(t.q('nav [data-tab="radnja"]'));
    const kb = t.q('[data-kupi="kazan"]');
    ok(kb && !kb.disabled, 'kazan deluje kupljivo sa tačno 600 din');
    t.klik(kb);
    ok(t.q('#toast').textContent.includes('Ostavi bar'), 'anti-softlock blokira trošenje zadnjeg dinara');
    ok(t.q('#novac').textContent.replace(/\D/g,'') === '600', 'novac netaknut posle blokade');

    // fuzz
    const rnd = a => a[Math.floor(Math.random()*a.length)];
    for(let i=0; i<400; i++){
      const akcija = Math.random();
      try{
        if(akcija < 0.30){
          const kl = t.qa('.parcela, .seme:not([disabled]), [data-prodaj], [data-isporuci]:not([disabled]), [data-odbij], [data-kuvaj]:not([disabled]), [data-pokupi]:not([disabled]), [data-kupi]:not([disabled]), #uberiSve, #nivoOk');
          t.klik(rnd(kl));
        } else if(akcija < 0.55){
          t.klik(rnd(t.qa('nav [data-tab]')));
        } else if(akcija < 0.75){
          t.skok(Math.floor(5000 + Math.random()*600000)); t.tick();
        } else if(akcija < 0.9){
          t.tick(2);
        } else {
          if(t.q('#list.otvoren')) t.klik(t.q('#veo'));
          t.zatvoriOverlay();
        }
      }catch(e){ greske.push('fuzz['+i+']: ' + (e && e.stack || e)); }
    }
    ok(t.q('nav'), 'UI živ posle fuzz testa');
    ok(t.qa('[data-isporuci]').length === 2, 'i dalje tačno 2 narudžbine posle fuzza');
    const sacuvano = JSON.parse(dom.window.__mem['moja-farma-v2']);
    ok(typeof sacuvano.novac === 'number' && sacuvano.novac >= 0, 'novac nikad negativan ('+sacuvano.novac+')');
    ok(Object.values(sacuvano.mag).every(v => Number.isInteger(v) && v >= 0), 'magacin bez negativnih/razlomljenih količina');
    ok(sacuvano.parcele.length <= 9, 'broj parcela ne prelazi maksimum');
  }

  console.log('\n================================');
  console.log('PROŠLO: ' + PROSLO + '  PALO: ' + PAD + '  GREŠKE U IZVRŠAVANJU: ' + greske.filter(g=>!g.startsWith('ASSERT')).length);
  if(greske.length){
    console.log('\nDetalji (prvih 12):');
    greske.slice(0,12).forEach(g => console.log(' - ' + g.split('\n').slice(0,3).join(' | ')));
  }
  process.exit(PAD || greske.length ? 1 : 0);
})();

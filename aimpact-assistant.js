(() => {
  'use strict';

  const FORM_ENDPOINT = 'https://formspree.io/f/mqeoqqgo';
  const CHECK_URL = 'https://aimpact.ch/sichtbarkeits-check.html';

  const topics = {
    local: {
      title: 'Local SEO',
      text: 'Local SEO hilft deinem Unternehmen, bei lokalen Google-Suchen besser gefunden zu werden. Aimpact optimiert dafür unter anderem Google Business Profile, lokale Suchbegriffe, Bewertungen, Standortsignale und relevante Inhalte.'
    },
    maps: {
      title: 'Google Maps',
      text: 'Google Maps ist besonders wichtig, wenn potenzielle Kunden nach Angeboten in ihrer Nähe suchen. Aimpact optimiert Profil, Leistungen, Kategorien, Inhalte und lokale Relevanzsignale, damit dein Unternehmen besser auffindbar wird.'
    },
    ai: {
      title: 'AI Visibility',
      text: 'AI Visibility beschreibt, wie gut dein Unternehmen und deine Inhalte von KI-Systemen verstanden und eingeordnet werden können. Aimpact verbessert dafür strukturierte Inhalte, FAQ, thematische Relevanz und klare Unternehmenssignale. Eine bestimmte Empfehlung in KI-Systemen kann seriös nicht garantiert werden.'
    },
    conversion: {
      title: 'Website & Conversion',
      text: 'Mehr Sichtbarkeit bringt wenig, wenn Besucher nicht verstehen, was du anbietest oder wie sie Kontakt aufnehmen sollen. Aimpact optimiert Struktur, Inhalte, Nutzerführung und Call-to-Actions, damit aus Besuchern mehr qualifizierte Anfragen werden.'
    }
  };

  const style = document.createElement('style');
  style.textContent = `
    #aimpact-assistant-root{
      --aa-black:#0a0a0a;--aa-panel:#121212;--aa-panel2:#191919;--aa-gold:#c9a84c;
      --aa-gold2:#dfbd5e;--aa-white:#f6f4ee;--aa-muted:#a7a39a;--aa-line:rgba(255,255,255,.12);
      position:relative;z-index:9999;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif
    }
    #aa-launcher{
      position:fixed;right:22px;bottom:22px;width:58px;height:58px;border-radius:50%;border:1px solid rgba(201,168,76,.45);
      background:var(--aa-gold);color:var(--aa-black);display:grid;place-items:center;cursor:pointer;
      box-shadow:0 16px 45px rgba(0,0,0,.38);font-weight:950;font-size:19px;transition:.2s ease
    }
    #aa-launcher:hover{transform:translateY(-2px);background:var(--aa-gold2)}
    #aa-launcher[aria-expanded="true"]{background:var(--aa-white)}
    #aa-window{
      position:fixed;right:22px;bottom:92px;width:min(390px,calc(100vw - 28px));height:min(620px,calc(100vh - 125px));
      display:none;flex-direction:column;overflow:hidden;border:1px solid rgba(201,168,76,.32);border-radius:22px;
      background:var(--aa-black);color:var(--aa-white);box-shadow:0 28px 90px rgba(0,0,0,.55)
    }
    #aa-window.open{display:flex}
    .aa-head{padding:18px 18px 15px;border-bottom:1px solid var(--aa-line);display:flex;justify-content:space-between;align-items:center;gap:14px;background:#0d0d0d}
    .aa-brand{font-weight:950;letter-spacing:.08em;text-transform:uppercase}
    .aa-brand span{color:var(--aa-gold)}
    .aa-status{font-size:11px;color:var(--aa-muted);margin-top:3px}
    .aa-close{border:0;background:transparent;color:var(--aa-muted);font-size:22px;cursor:pointer;padding:4px 7px}
    .aa-chat{flex:1;overflow:auto;padding:16px;scroll-behavior:smooth}
    .aa-msg{max-width:88%;margin:0 0 12px;padding:12px 14px;border-radius:16px;line-height:1.5;font-size:14px}
    .aa-bot{background:var(--aa-panel2);border:1px solid var(--aa-line);border-bottom-left-radius:5px}
    .aa-user{background:var(--aa-gold);color:var(--aa-black);margin-left:auto;border-bottom-right-radius:5px;font-weight:700}
    .aa-options{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 18px}
    .aa-chip{border:1px solid rgba(201,168,76,.38);background:#111;color:#e8e4da;border-radius:999px;padding:9px 11px;cursor:pointer;font-size:12px;font-weight:800}
    .aa-chip:hover{background:rgba(201,168,76,.13);border-color:var(--aa-gold)}
    .aa-primary{display:inline-flex;text-decoration:none!important;background:var(--aa-gold);color:var(--aa-black)!important;border-radius:999px;padding:11px 14px;font-size:12px;font-weight:950;margin-top:8px}
    .aa-lead{margin-top:10px;padding:14px;border:1px solid var(--aa-line);border-radius:15px;background:#101010}
    .aa-lead label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:#77736c;margin:11px 0 5px}
    .aa-lead label:first-child{margin-top:0}
    .aa-lead input,.aa-lead select,.aa-lead textarea{
      width:100%;border:1px solid #333;background:#161616;color:var(--aa-white);border-radius:10px;padding:10px 11px;outline:none
    }
    .aa-lead textarea{resize:vertical;min-height:72px}
    .aa-lead input:focus,.aa-lead select:focus,.aa-lead textarea:focus{border-color:var(--aa-gold)}
    .aa-submit{width:100%;margin-top:13px;border:0;border-radius:999px;background:var(--aa-gold);color:var(--aa-black);padding:12px;font-weight:950;cursor:pointer}
    .aa-submit:disabled{opacity:.55;cursor:not-allowed}
    .aa-note{font-size:10px;color:#77736c;line-height:1.4;margin-top:9px}
    .aa-foot{padding:10px 14px;border-top:1px solid var(--aa-line);font-size:10px;color:#69665f;text-align:center;background:#0d0d0d}
    @media(max-width:600px){
      #aa-launcher{right:14px;bottom:14px}
      #aa-window{left:14px;right:14px;bottom:84px;width:auto;height:min(650px,calc(100vh - 106px))}
    }
    @media(prefers-reduced-motion:reduce){#aa-launcher{transition:none}.aa-chat{scroll-behavior:auto}}
  `;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'aimpact-assistant-root';
  root.innerHTML = `
    <button id="aa-launcher" aria-label="Aimpact Assistant öffnen" aria-expanded="false">A<span style="color:#fff">i</span></button>
    <section id="aa-window" role="dialog" aria-label="Aimpact Assistant" aria-hidden="true">
      <div class="aa-head">
        <div>
          <div class="aa-brand">A<span>i</span>mpact Assistant</div>
          <div class="aa-status">Schnelle Antworten · direkter Weg zum nächsten Schritt</div>
        </div>
        <button class="aa-close" aria-label="Chat schliessen">×</button>
      </div>
      <div class="aa-chat" id="aa-chat"></div>
      <div class="aa-foot">Aimpact · Zürich · keine automatische Garantie für Rankings oder KI-Empfehlungen</div>
    </section>
  `;
  document.body.appendChild(root);

  const launcher = root.querySelector('#aa-launcher');
  const win = root.querySelector('#aa-window');
  const closeBtn = root.querySelector('.aa-close');
  const chat = root.querySelector('#aa-chat');

  function scrollDown(){ chat.scrollTop = chat.scrollHeight; }

  function addMessage(text, who='bot', allowHtml=false){
    const div = document.createElement('div');
    div.className = `aa-msg ${who === 'user' ? 'aa-user' : 'aa-bot'}`;
    if(allowHtml) div.innerHTML = text;
    else div.textContent = text;
    chat.appendChild(div);
    scrollDown();
    return div;
  }

  function addOptions(){
    const box = document.createElement('div');
    box.className = 'aa-options';
    const opts = [
      ['Local SEO','local'],
      ['Google Maps','maps'],
      ['AI Visibility','ai'],
      ['Website & Conversion','conversion'],
      ['Visibility Check','check'],
      ['Kostenlose Analyse','lead']
    ];
    opts.forEach(([label,key])=>{
      const b=document.createElement('button');
      b.className='aa-chip';
      b.type='button';
      b.textContent=label;
      b.addEventListener('click',()=>handleChoice(key,label));
      box.appendChild(b);
    });
    chat.appendChild(box);
    scrollDown();
  }

  function handleChoice(key,label){
    addMessage(label,'user');
    if(topics[key]){
      addMessage(`<strong>${topics[key].title}</strong><br>${topics[key].text}`, 'bot', true);
      addOptions();
      return;
    }
    if(key==='check'){
      addMessage(
        `Mit dem kostenlosen Aimpact Visibility Check erhältst du eine erste Einschätzung deiner Sichtbarkeit bei Google, Maps, Website, Content, AI Visibility und Conversion.<br><a class="aa-primary" href="${CHECK_URL}">Visibility Check starten →</a>`,
        'bot', true
      );
      addOptions();
      return;
    }
    if(key==='lead') showLeadForm();
  }

  function showLeadForm(){
    addMessage('Gerne. Hinterlasse mir kurz deine Angaben und dein wichtigstes Anliegen. Aimpact erhält die Anfrage direkt.', 'bot');
    const wrap=document.createElement('div');
    wrap.className='aa-lead';
    wrap.innerHTML=`
      <form id="aa-lead-form">
        <label>Name *</label>
        <input name="name" autocomplete="name" required placeholder="Dein Name">
        <label>Unternehmen *</label>
        <input name="unternehmen" required placeholder="Dein Unternehmen">
        <label>E-Mail *</label>
        <input type="email" name="email" autocomplete="email" required placeholder="name@unternehmen.ch">
        <label>Telefon (optional)</label>
        <input type="tel" name="telefon" autocomplete="tel" placeholder="+41 ...">
        <label>Wobei brauchst du Unterstützung? *</label>
        <select name="anliegen" required>
          <option value="">Bitte auswählen</option>
          <option>Google Sichtbarkeit</option>
          <option>Google Maps</option>
          <option>AI Visibility</option>
          <option>Website & Conversion</option>
          <option>Content</option>
          <option>Mehr Anfragen</option>
          <option>Anderes Anliegen</option>
        </select>
        <label>Kurze Nachricht (optional)</label>
        <textarea name="nachricht" placeholder="Was möchtest du verbessern?"></textarea>
        <input type="hidden" name="source" value="Aimpact Assistant">
        <button class="aa-submit" type="submit">Anfrage senden</button>
        <p class="aa-note">Mit dem Absenden übermittelst du die eingegebenen Angaben an Aimpact zur Bearbeitung deiner Anfrage.</p>
      </form>`;
    chat.appendChild(wrap);
    scrollDown();

    const form=wrap.querySelector('#aa-lead-form');
    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const btn=form.querySelector('.aa-submit');
      btn.disabled=true;
      btn.textContent='Wird gesendet...';

      try{
        const res=await fetch(FORM_ENDPOINT,{
          method:'POST',
          body:new FormData(form),
          headers:{'Accept':'application/json'}
        });
        if(!res.ok) throw new Error('Form submission failed');

        if(typeof window.gtag === 'function'){
          window.gtag('event','generate_lead',{
            lead_source:'aimpact_assistant',
            form_name:'Aimpact Assistant'
          });
        }

        wrap.remove();
        addMessage('Danke. Deine Anfrage wurde übermittelt. Aimpact schaut sich dein Anliegen an und meldet sich bei dir.', 'bot');
      }catch(err){
        btn.disabled=false;
        btn.textContent='Erneut versuchen';
        addMessage('Die Anfrage konnte gerade nicht gesendet werden. Bitte versuche es erneut oder nutze den Visibility Check.', 'bot');
      }
    });
  }

  let initialized=false;
  function openChat(){
    win.classList.add('open');
    win.setAttribute('aria-hidden','false');
    launcher.setAttribute('aria-expanded','true');
    if(!initialized){
      initialized=true;
      addMessage('Willkommen bei Aimpact. Wobei kann ich dir helfen? Du kannst mehr über Local SEO, Google Maps, AI Visibility oder Website & Conversion erfahren – oder direkt deine Sichtbarkeit prüfen.');
      addOptions();
    }
  }
  function closeChat(){
    win.classList.remove('open');
    win.setAttribute('aria-hidden','true');
    launcher.setAttribute('aria-expanded','false');
  }

  launcher.addEventListener('click',()=>win.classList.contains('open')?closeChat():openChat());
  closeBtn.addEventListener('click',closeChat);
  document.addEventListener('keydown',(e)=>{if(e.key==='Escape') closeChat();});
})();
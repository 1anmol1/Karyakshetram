import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApp } from '../lib/state.jsx';
import { Icon } from './ui.jsx';

// AI chatbot (bottom-right). Answers only from the evidence of current results; template text when no LLM is configured.
export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const { picks, category } = useApp();
  const loc = useLocation();
  const end = useRef(null);
  const cellId = loc.pathname.startsWith('/location/') ? loc.pathname.split('/')[2] : undefined;
  const pickCells = picks.filter((p) => !p.empty).map((p) => p.cell);
  const ctxName = cellId ? 'this location' : pickCells.length ? 'your current picks' : null;
  const suggestions = cellId
    ? ['Why does this site rank well?', 'What rent makes it stop making money?', 'What breaks it in the stress tests?', 'How much will it take from my stores?']
    : ['Why is the best pick ranked first?', 'Which pick is safest if rent rises 25%?', 'How much will the best pick take from my stores?'];
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);
  useEffect(() => { setMsgs([]); }, [category]);

  const ask = async (q) => {
    const m = (q ?? text).trim(); if (!m || busy) return;
    setText(''); setMsgs((x) => [...x, { me: true, text: m }]); setBusy(true);
    try {
      const r = await api('/chat', { method: 'POST', body: { message: m, category, cellId, picks: cellId ? undefined : pickCells } });
      setMsgs((x) => [...x, { text: r.answer, evidence: r.evidence, source: r.narrative_source }]);
    } catch (e) {
      setMsgs((x) => [...x, { text: e.message, error: true }]);
    } finally { setBusy(false); }
  };

  return (<>
    {open && <div className="chatbox" role="dialog" aria-label="Ask Karyakshetram">
      <div className="row sb pad16" style={{ borderBottom: '1px solid var(--line)' }}>
        <span className="row g8 b"><Icon n="sparkling-2-fill" s={18} c="var(--accent)" />Ask Karyakshetram</span>
        <span className="row g8"><button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => setMsgs([])} aria-label="Clear chat"><Icon n="delete-bin-line" s={15} /></button><button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => setOpen(false)} aria-label="Close chat"><Icon n="close-line" s={16} /></button></span>
      </div>
      <div className="col g12 pad16 f1" style={{ overflowY: 'auto' }}>
        <div className="s13 muted">{ctxName ? `Ask about ${ctxName}. Answers only use numbers from your results.` : 'Search a locality or open a location first, then ask about it.'}</div>
        {!msgs.length && ctxName && <div className="col g8" style={{ alignItems: 'flex-end' }}>{suggestions.map((s) => <button key={s} className="chip" onClick={() => ask(s)}>{s}</button>)}</div>}
        {msgs.map((m, i) => m.me ? <div key={i} className="bubble-me">{m.text}</div> : (
          <div key={i} className="bubble-ai col g8" style={m.error ? { color: 'var(--bad)' } : undefined}>
            <span style={{ lineHeight: 1.55 }}>{m.text}</span>
            {m.evidence?.length > 0 && <span className="row g6 wrap">{m.evidence.map((e) => <span key={e} className="tag">{e}</span>)}</span>}
            {m.source && <span className="s11 muted">{m.source === 'llm' ? 'AI · validated against evidence' : 'Template answer from evidence record'}</span>}
          </div>))}
        {busy && <div className="bubble-ai row g6 muted"><Icon n="loader-4-line" className="spin" />Thinking…</div>}
        <div ref={end} />
      </div>
      <form className="row g8 pad12" style={{ borderTop: '1px solid var(--line)' }} onSubmit={(e) => { e.preventDefault(); ask(); }}>
        <div className="input f1"><input placeholder="Ask a question…" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} aria-label="Question" /></div>
        <button className="iconbtn" style={{ background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }} disabled={busy || !text.trim()} aria-label="Send"><Icon n="send-plane-2-fill" s={16} /></button>
      </form>
    </div>}
    <button className="fab" onClick={() => setOpen(!open)} aria-label={open ? 'Close chat' : 'Open AI chat'}><Icon n={open ? 'close-line' : 'sparkling-2-fill'} /></button>
  </>);
}

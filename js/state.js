const PREFIX = 'energy-islands-v1';
export const storage = { get(k, fallback) { try { return JSON.parse(localStorage.getItem(PREFIX + k)) ?? fallback } catch { return fallback } }, set(k, v) { try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); return true } catch { return false } } };
export const fresh = (name = '', avatar = 0) => ({ version: 1, name, avatar, visited: [], correct: {}, best: {}, stamps: [], current: 'center', finalPassed: false, traded: [], bag: { shell: 3 }, picked: {}, experiments: {} });
export function createState(data, onchange) {
    const ids = data.islands.map(i => i.id); const questions = data.islands.flatMap(i => i.questions).map(q => q.id);
    let profiles = storage.get(':profiles', {}), active = storage.get(':active', ''); if (!profiles || typeof profiles !== 'object' || Array.isArray(profiles)) profiles = {}; let s = Object.hasOwn(profiles, active) ? profiles[active] : fresh();
    function valid(v) {
        if (!v || v.version !== 1 || typeof v.name !== 'string' || [...v.name].length < 2 || [...v.name].length > 12 || ['__proto__', 'constructor', 'prototype'].includes(v.name) || ![0, 1, 2].includes(v.avatar)) throw Error('存档的冒险者资料不正确。');
        if (!Array.isArray(v.visited) || !Array.isArray(v.stamps) || !v.correct || !v.best || !v.experiments) throw Error('存档缺少必要字段。');
        if (v.visited.some(x => !ids.includes(x)) || v.stamps.some(x => !ids.includes(x)) || ![...ids, 'center'].includes(v.current)) throw Error('存档中的岛屿不属于本站。');
        if (Object.entries(v.correct).some(([id, n]) => !questions.includes(id) || !Number.isInteger(n) || n < 1 || n > 100000)) throw Error('答题记录格式不正确。');
        if (Object.entries(v.best).some(([id, n]) => !ids.includes(id) || !Number.isInteger(n) || n < 0 || n > 10) || v.stamps.some(id => (v.best[id] || 0) < 2)) throw Error('岛章与成绩不一致。');
        if (typeof v.finalPassed !== 'boolean') throw Error('游戏记录格式不正确。');
        if (Object.entries(v.experiments).some(([id, rows]) => ![...ids, 'center'].includes(id) || !Array.isArray(rows) || rows.length > 6 || rows.some(r => !r || ['type', 'condition', 'value'].some(k => typeof r[k] !== 'string' || r[k].length > 100)))) throw Error('实验记录格式不正确。');
        return { ...fresh(), ...v, visited: [...new Set(v.visited)], stamps: [...new Set(v.stamps)], traded: Array.isArray(v.traded) ? [...new Set(v.traded)] : [] };
    }
    try { if (s.name) s = valid(s) } catch { s = fresh(); active = '' }
    function save() { if (s.name) { profiles[s.name] = s; storage.set(':profiles', profiles); storage.set(':active', s.name) } onchange?.(s) }
    function exp() { const r = data.rpgRules; return s.visited.length * r.firstVisit + s.stamps.length * r.firstClear + Object.values(s.correct).reduce((a, n) => a + r.firstCorrect + (n - 1) * r.repeatCorrect, 0) }
    function level() { let e = exp(), ls = data.rpgRules.levels; if (e >= ls.at(-1)) return 5 + Math.floor((e - ls.at(-1)) / data.rpgRules.laterLevelStep); return ls.filter(x => e >= x).length }
    return {
        get value() { return s }, exp, level, save, valid,
        select(name, avatar) { name = name.trim(); if ([...name].length < 2 || [...name].length > 12 || ['__proto__', 'constructor', 'prototype'].includes(name)) throw Error('请输入2～12个字的冒险者代号。'); s = Object.hasOwn(profiles, name) ? valid(profiles[name]) : fresh(name, avatar); save(); return s },
        guest() { s = fresh(); storage.set(':active', ''); onchange?.(s) },
        names() { return Object.keys(profiles) },
        visit(id) { s.current = id; if (s.name && ids.includes(id) && !s.visited.includes(id)) s.visited.push(id); save() },
        answer(id, correct) { if (s.name && correct) s.correct[id] = (s.correct[id] || 0) + 1; save() },
        finish(id, score) { if (s.name) { if (id === 'center') { if (score >= 4) s.finalPassed = true } else { s.best[id] = Math.max(s.best[id] || 0, score); if (score >= 2 && !s.stamps.includes(id)) s.stamps.push(id) } save() } },
        unlocked() { return s.stamps.length >= data.rpgRules.centerUnlockStamps },
        certificate() { return s.stamps.length === ids.length && s.finalPassed },
        reset() { s = fresh(s.name, s.avatar); save() },
        import(v) { s = valid(v); save(); return s },
        json() { return JSON.stringify(s) },
        code() { const raw = JSON.stringify(s), bytes = new TextEncoder().encode(raw); let binary = ''; bytes.forEach(b => binary += String.fromCharCode(b)); return 'ENERGYEX1.' + btoa(binary) + '.' + checksum(raw) },
        decode(code) { if (code.length > 200000) throw Error('接关码过长，请检查复制内容。'); const parts = code.trim().split('.'); if (parts.length !== 3 || parts[0] !== 'ENERGYEX1') throw Error('接关码格式不正确，请复制完整的 ENERGYEX1. 开头代码。'); let raw; try { raw = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(parts[1]), c => c.charCodeAt(0))) } catch { throw Error('接关码无法解码，请检查是否漏字。') } if (checksum(raw) !== parts[2]) throw Error('接关码校验失败，内容可能被改动或复制不完整。'); return this.import(JSON.parse(raw)) }
    };
}
function checksum(str) { let h = 2166136261; for (const b of new TextEncoder().encode(str)) { h ^= b; h = Math.imul(h, 16777619) } return (h >>> 0).toString(16).padStart(8, '0') }
export function shuffle(a) { const out = [...a]; for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[out[i], out[j]] = [out[j], out[i]] } return out }
export function escapeHTML(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) }

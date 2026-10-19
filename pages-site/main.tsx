import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';
import { authClient } from '../lib/client-api';
import SalesApp from '../app/sales-app';
import '../app/globals.css';
function App() {
  const [session,setSession] = useState<Session|null>(null);
  const [ready,setReady] = useState(false), [email,setEmail] = useState(''), [password,setPassword] = useState('');
  const [busy,setBusy] = useState(false), [error,setError] = useState(''), [recovery,setRecovery] = useState(location.hash.includes('type=recovery') || location.hash.includes('type=invite'));
  useEffect(() => {
    authClient.auth.getSession().then(({data}) => {setSession(data.session);setReady(true)});
    const { data } = authClient.auth.onAuthStateChange((event,next) => {setSession(next); if(event==='PASSWORD_RECOVERY') setRecovery(true)});
    return () => data.subscription.unsubscribe();
  },[]);
  if(!ready) return <p role="status">読み込み中…</p>;
  if(session && !recovery) return <><button className="account-logout" onClick={async()=>{const {error}=await authClient.auth.signOut();if(error) alert(error.message)}}>ログアウト</button><SalesApp key={session.user.id} userName={session.user.email?.startsWith('monoralorder@') ? '物流倉庫' : '事務所'}/></>;
  return <main className="login-page"><form className="panel login-card" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try {
    if(recovery && session) {const {error}=await authClient.auth.updateUser({password});if(error) throw error;setRecovery(false);setPassword('');}
    else {const {error}=await authClient.auth.signInWithPassword({email: email.trim().toLowerCase() + '@login.monoral.invalid',password});if(error) throw new Error('ログインIDまたはパスワードを確認してください。');}
  } catch(e){setError((e as Error).message)} finally {setBusy(false)}}}>
    <span className="monoral-logo"><img src="./brand/monoral_h6.png" alt="MONORAL"/></span>
    <h1>{recovery && session ? 'パスワードを設定' : '販売管理にログイン'}</h1>
    <p>事務所・物流倉庫で同じ業務データを利用できます。</p>
    {!recovery && <label>ログインID<input type="text" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label>}
    <label>パスワード<input type="password" autoComplete={recovery?'new-password':'current-password'} minLength={recovery?12:1} required value={password} onChange={e=>setPassword(e.target.value)}/></label>
    {error && <p role="alert">{error}</p>}
    <button className="primary" disabled={busy}>{busy?'処理中…':recovery?'パスワードを保存':'ログイン'}</button>
    <p className="muted">ID：事務所 monoral ／ 物流倉庫 monoralorder<br/>パスワードを忘れた場合は管理者へご連絡ください。</p>
  </form></main>;
}
createRoot(document.getElementById('root')!).render(<App/>);


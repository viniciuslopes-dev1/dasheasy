import { FormEvent, useState } from 'react';
import { AlertTriangle, LockKeyhole } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AdminLoginProps {
  onSignedIn: () => void;
}

export default function AdminLogin({ onSignedIn }: AdminLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!supabase) {
      setError('Supabase não está configurado neste ambiente.');
      return;
    }

    setIsSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setIsSubmitting(false);

    if (signInError) {
      setError('E-mail ou senha inválidos.');
      return;
    }

    onSignedIn();
  }

  return (
    <main className="admin-login-page">
      <form className="panel admin-login-card" onSubmit={handleSubmit}>
        <div className="login-mark">
          <LockKeyhole size={24} />
        </div>
        <span className="section-label">Área administrativa</span>
        <h1>Entrar no DashEasy</h1>
        <p>Apenas o usuário principal pode importar, publicar e republicar versões do dashboard.</p>

        <label>
          <span>E-mail</span>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            autoComplete="email"
            required
            placeholder="admin@empresa.com"
          />
        </label>

        <label>
          <span>Senha</span>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="current-password"
            required
            placeholder="Sua senha"
          />
        </label>

        {error ? (
          <div className="status error">
            <AlertTriangle size={16} />
            {error}
          </div>
        ) : null}

        <button className="primary-action" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}

import { FormEvent, useState } from 'react';
import { AlertTriangle, LockKeyhole } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { isDashboardAdmin } from '../../services/adminAuthorizationService';
import { getAdminAuthDomain, resolveAdminLoginEmail } from '../../services/adminLoginService';

interface AdminLoginProps {
  onSignedIn: () => void;
}

export default function AdminLogin({ onSignedIn }: AdminLoginProps) {
  const [loginName, setLoginName] = useState('');
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

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: resolveAdminLoginEmail(loginName, getAdminAuthDomain()),
        password,
      });

      if (signInError) {
        setError('Nome ou senha inválidos.');
        return;
      }

      if (!(await isDashboardAdmin())) {
        await supabase.auth.signOut();
        setError('Esta conta não possui acesso administrativo.');
        return;
      }

      onSignedIn();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível verificar o acesso administrativo.',
      );
    } finally {
      setIsSubmitting(false);
    }
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
          <span>Nome</span>
          <input
            value={loginName}
            onChange={(event) => setLoginName(event.target.value)}
            type="text"
            autoComplete="username"
            required
            placeholder="admin"
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

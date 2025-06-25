
import { redirect } from 'next/navigation';

// Esta página redireciona para o login, pois o cadastro público foi desativado.
export default function SignupPageDisabled() {
  redirect('/login');
  // O return não é alcançado, mas é bom para o TypeScript.
  return null;
}


import { useAccount } from 'wagmi';
import { useUser } from "@openfort/react";
import { AuthContainer } from './components/auth/AuthContainer';
import { Dashboard } from './views/Dashboard';

export default function App() {
  const { connector } = useAccount();
  const { user } = useUser();
  const isMiniApp = connector?.id === 'farcaster';
  const showApp = isMiniApp ? true : !!user;

  if (!showApp && !isMiniApp) {
    return <AuthContainer />;
  }
  return <Dashboard />;
}

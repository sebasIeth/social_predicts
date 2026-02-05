
import { useAccount } from 'wagmi';
import { useUser } from "@openfort/react";
import { AuthContainer } from './components/auth/AuthContainer';
import { Dashboard } from './views/Dashboard';
import { WrongNetworkAlert } from './components/WrongNetworkAlert';
import { config } from './wagmi';

export default function App() {
  const { connector, isConnected, chainId } = useAccount();
  const { user } = useUser();
  const isMiniApp = connector?.id === 'farcaster';
  const showApp = isMiniApp ? true : !!user;

  // Strict Network Guard
  // If we are connected via a standard wallet (not mini-app implicit) and on the wrong chain
  const isWrongNetwork = isConnected && chainId && !config.chains.some(c => c.id === chainId);

  if (isWrongNetwork) {
    return <WrongNetworkAlert />;
  }

  if (!showApp && !isMiniApp) {
    return <AuthContainer />;
  }
  return <Dashboard />;
}

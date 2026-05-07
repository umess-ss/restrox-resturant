/**
 * Compatibility shim — delegates to the shared SocketContext.
 * Existing components that import useSocket() continue to work unchanged.
 * New components should import useSocketContext() directly.
 */
import { useSocketContext } from '../socket/SocketContext.jsx';

export default function useSocket() {
  const { socket, connected } = useSocketContext();
  return { socket, connected };
}

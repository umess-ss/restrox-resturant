/**
 * Singleton holder for the Socket.IO instance.
 * Avoids circular imports — modules import getIO() instead of the full socket setup.
 */
let _io = null;

export const setIO = (io) => { _io = io; };
export const getIO = () => _io;

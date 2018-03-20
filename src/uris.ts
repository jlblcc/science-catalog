/**
 * Simply exports base URIs for the application server.  Held in its own
 * module so that the client and server can cleanly share this info.
 */

/**
 * The base uri where all content resides.
 * This is not simply `/` so that the applicatin server can be reverse proxied
 * into a website under this same path and keep things simple.
 */
export const BASE_URI = '/science-catalog';
/** Where the `api` lives relative to the `BASE_URI` */
export const API_PREFIX = '/api';
/** `BASE_URI` and `API_PREFIX` put together for convenience */
export const BASE_API_URI = `${BASE_URI}${API_PREFIX}`;

import { generateKeyPairSync } from 'node:crypto';

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const privateJwk = privateKey.export({ format: 'jwk' });
const publicJwk = publicKey.export({ format: 'jwk' });
const encode = (value) => Buffer.from(value, 'base64url').toString('base64url');
const publicBytes = Buffer.concat([Buffer.from([4]), Buffer.from(publicJwk.x, 'base64url'), Buffer.from(publicJwk.y, 'base64url')]);
console.log(JSON.stringify({ publicKey: encode(publicBytes), privateKey: encode(Buffer.from(privateJwk.d, 'base64url')) }, null, 2));

# alerts-state

Written by the Guardian alerts workflow. `subscribers.enc.json` is the list of who watches which vault,
encrypted with AES-256-GCM using a key derived from the bot token. It can't be read without that secret.
Don't edit this branch by hand.

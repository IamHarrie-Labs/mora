/**
 * The "stolen key" scenario, run for real against the deployed contracts on Base Sepolia (9 Nov 2026).
 * Every step is a real transaction anyone can check on Basescan.
 */
export const LIVE = {
  factory: "0x967cd50D421d497EF2D1753635bDC30F3Acd514B",
  usdc: "0x15675CcFBa9E7Ca64fFe64cDD4D8DBc75e219636",
  implementation: "0x9602447cAaC26C34E9ee0B41a6316032268724ED",
  vault: "0x49879021E8C90B25514F3ba03F15a82eb7C44580",
} as const;

export const PROOF_STEPS: { text: string; tx: string }[] = [
  { text: "Vault created: $200/day instant, 1h delay, 1 guardian, recovery wallet set", tx: "0x9c8ad6a2380b0b7295e10a25948369a1d46553d37e6cef917c4161e04eddd2b8" },
  { text: "$10,000 test USDC deposited", tx: "0x3ec5fc2ddf6bf2b89dd1e741b559e14ec00bd6d751c0dae99cc2d9f78ed38419" },
  { text: "$50 sent instantly, inside the allowance", tx: "0xa5c67f7cec592ee31afa03128afc7ae0e20f7fff22a92d6434b774a1b3f1fd66" },
  { text: "Stolen key asks to send $5,000. The vault queues it", tx: "0x8db72ec54dc11ba872520a22e0127b3e44dc64397418ed878f4618e8309c254d" },
  { text: "Stolen key asks to change the recovery address. Also queued", tx: "0xcab1125591bdee4f063246586838b53a66f76563a5b334a5fd6039213ad9e047" },
  { text: "Guardian presses Rescue. $9,950 goes to the recovery wallet and both requests are void. The thief gets $0", tx: "0xbeea5b9b4c6ca60d6e1e19d36ee658a60ae430a846de2140b128bb81bd5f4dfe" },
];

export const basescan = (kind: "tx" | "address", v: string) => `https://sepolia.basescan.org/${kind}/${v}`;

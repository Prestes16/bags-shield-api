const body = BodySchema.parse(await readJson(req));
// MVP: permitir scan por transactionSig sem mint (resposta parcial)
if (!body.mint && body.transactionSig) {
  return sendJson(res, 201, {
    ok: true,
    txOnly: true,
    transactionSig: body.transactionSig,
    note: 'Scan por transactionSig aceito (MVP). Mint real será resolvido na Fase 4.',
    network: body.network
  });
}

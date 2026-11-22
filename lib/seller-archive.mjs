// A reversible removal: seller IDs and every accounting link remain intact.
export async function setSellerArchived(pool, sellerId, archived) {
  const id = String(sellerId ?? '').trim();
  if (!/^[1-9]\d*$/.test(id)) { const error = new Error('Invalid seller ID.'); error.status = 400; throw error; }
  const result = await pool.query(`
    UPDATE sellers
    SET archived_at = ${archived ? 'COALESCE(archived_at, NOW())' : 'NULL'},
        active = FALSE,
        automatic_reports_enabled = FALSE
    WHERE id = $1 ${archived ? '' : 'AND archived_at IS NOT NULL'}
    RETURNING id, name, referral_code, archived_at, active, automatic_reports_enabled
  `, [id]);
  if (!result.rows.length) { const error = new Error('Seller not found.'); error.status = 404; throw error; }
  return result.rows[0];
}
export function installSellerArchiveRoutes(app, pool, requireAdmin) {
  for (const [method, path, archived] of [['delete','/api/admin/sellers/:id',true],['post','/api/admin/sellers/:id/restore',false]]) {
    app[method](path, requireAdmin, async (req, res) => {
      try {
        const seller = await setSellerArchived(pool, req.params.id, archived);
        res.json({seller, accountingPreserved: true});
      } catch (error) {
        if (!error.status) console.error('Seller archive update failed:', error);
        res.status(error.status || 500).json({error: error.status ? error.message : 'Could not update seller archive.'});
      }
    });
  }
}

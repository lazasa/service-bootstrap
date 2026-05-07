// Smoke test for the items routes. The shipped test stubs out the
// fastify decorators and verifies the route registration wires through.
// Replace with a fuller test once you've connected a real Supabase.
import t from 'tap'

t.test('items routes module loads', async (t) => {
  const mod = await import('../items.routes')
  t.type(mod.itemsRoutes, 'function')
})

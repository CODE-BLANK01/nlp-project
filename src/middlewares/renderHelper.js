export function renderPage(res, view, data = {}) {
  const defaults = {
    user: null,
    email: null,
    tenant: null,
    message: null,
    error: null,
    users: [],
    doc: null,
    answer: null,
  };
  res.render(view, { ...defaults, ...data });
}
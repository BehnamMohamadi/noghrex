export function pagination(query = {}) {
  const page = Math.min(Math.max(Number.isFinite(Number(query.page)) ? Math.trunc(Number(query.page)) : 1, 1), 1000000);
  const limit = Math.min(Math.max(Number.isFinite(Number(query.limit)) ? Math.trunc(Number(query.limit)) : 50, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
}
export async function paginate(model, filter, query = {}) {
  const { page, limit, skip } = pagination(query);
  const [items, total] = await Promise.all([model.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(), model.countDocuments(filter)]);
  return { items, page, perPage: limit, total, totalPages: Math.ceil(total / limit) };
}

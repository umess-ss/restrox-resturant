import Table from './table.model.js';

export const getTables = async (req, res) => {
  const { status } = req.query;
  const tables = await Table.find(status ? { status } : {}).sort('number');
  res.json(tables);
};

export const createTable = async (req, res) => {
  const table = await Table.create(req.body);
  res.status(201).json(table);
};

export const updateTable = async (req, res) => {
  const table = await Table.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!table) return res.status(404).json({ message: 'Table not found' });
  res.json(table);
};

export const deleteTable = async (req, res) => {
  const table = await Table.findByIdAndDelete(req.params.id);
  if (!table) return res.status(404).json({ message: 'Table not found' });
  res.status(204).send();
};

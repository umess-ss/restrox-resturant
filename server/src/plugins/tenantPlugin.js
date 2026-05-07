import mongoose from 'mongoose';

/**
 * tenantFields(branchScoped)
 *
 * Returns the Mongoose field definitions to add to any tenant-scoped schema.
 * Use schema.add(tenantFields()) instead of a plugin to stay ESM-compatible.
 *
 * @param {boolean} branchScoped - also add a `branch` field
 * @param {boolean} required     - make restaurant required (default true)
 */
export const tenantFields = (branchScoped = false, required = true) => {
  const fields = {
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required,
      index: true,
    },
  };
  if (branchScoped) {
    fields.branch = {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      index: true,
    };
  }
  return fields;
};

/**
 * addTenantIndexes(schema, branchScoped)
 * Call after schema.add(tenantFields()) to add compound indexes.
 */
export const addTenantIndexes = (schema, branchScoped = false) => {
  schema.index({ restaurant: 1, createdAt: -1 });
  if (branchScoped) {
    schema.index({ restaurant: 1, branch: 1, createdAt: -1 });
  }
};

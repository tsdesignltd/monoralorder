import { customerSchema, type Customer } from "./model";
export function parseCustomerImport(input: unknown): Customer[] {
  if (
    !input ||
    typeof input !== "object" ||
    !("customers" in input) ||
    !Array.isArray(input.customers) ||
    input.customers.length > 2000
  )
    throw new Error("顧客インポートJSONの形式が正しくありません");
  const customers = input.customers.map((item: unknown) =>
    customerSchema.parse(item),
  );
  if (
    customers.some((c) => !c.legacyId) ||
    new Set(customers.map((c) => c.legacyId)).size !== customers.length
  )
    throw new Error("旧顧客番号が空欄または重複しています");
  return customers;
}

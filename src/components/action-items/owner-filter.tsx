import { FilterSelect } from '@/components/ui/filter-select';

interface Owner {
  id: string;
  full_name: string;
  email: string;
}

interface OwnerFilterProps {
  owners: Owner[];
  currentOwner?: string;
}

export function OwnerFilter({ owners, currentOwner }: OwnerFilterProps) {
  const options = owners.map((o) => ({
    id: o.id,
    label: o.full_name,
  }));

  return (
    <FilterSelect
      paramName="owner"
      options={options}
      currentValue={currentOwner}
      placeholder="All Owners"
    />
  );
}

























'use client';

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
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const url = new URL(window.location.href);
    if (e.target.value) {
      url.searchParams.set('owner', e.target.value);
    } else {
      url.searchParams.delete('owner');
    }
    window.location.href = url.toString();
  };

  return (
    <select
      className="input w-48"
      defaultValue={currentOwner || ''}
      onChange={handleChange}
    >
      <option value="">All Owners</option>
      {owners.map((o) => (
        <option key={o.id} value={o.id}>
          {o.full_name}
        </option>
      ))}
    </select>
  );
}
export function singerNameColor(gender?: string | null) {
  switch (gender?.trim().toLocaleLowerCase()) {
    case 'male':
      return '#2563EB';
    case 'female':
      return '#DB2777';
    case 'boy':
      return '#566F89';
    case 'girl':
      return '#965D78';
    default:
      return undefined;
  }
}
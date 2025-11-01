type ClassValue = string | number | boolean | undefined | null | ClassValue[];

export function cn(...inputs: ClassValue[]) {
  // Flatten and filter array
  const classes: string[] = [];
  
  inputs.forEach(input => {
    if (!input) return;
    
    if (typeof input === 'string') {
      classes.push(input);
    } else if (Array.isArray(input)) {
      const result = cn(...input);
      if (result) classes.push(result);
    }
  });
  
  // Simple merge - just join classes
  return classes.join(' ');
}

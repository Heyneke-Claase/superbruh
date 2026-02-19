export const getCountryCode = (teamName: string): string => {
  const map: Record<string, string> = {
    'South Africa': 'ZA',
    'India': 'IN',
    'Australia': 'AU',
    'England': 'GB',
    'New Zealand': 'NZ',
    'Pakistan': 'PK',
    'Sri Lanka': 'LK',
    'West Indies': 'JM', // Using Jamaica as a placeholder for WI
    'Bangladesh': 'BD',
    'Afghanistan': 'AF',
    'Ireland': 'IE',
    'Zimbabwe': 'ZW',
    'Netherlands': 'NL',
    'Scotland': 'GB',
    'Namibia': 'NA',
    'Oman': 'OM',
    'Nepal': 'NP',
    'USA': 'US',
    'United States': 'US',
    'Canada': 'CA',
    'Uganda': 'UG',
    'Papua New Guinea': 'PG',
    'UAE': 'AE',
    'United Arab Emirates': 'AE',
  };

  return map[teamName] || '';
};

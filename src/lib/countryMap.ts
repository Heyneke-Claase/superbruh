export const getTeamFlag = (teamName: string): string => {
  const map: Record<string, string> = {
    'South Africa': 'ZA',
    'India': 'IN',
    'Australia': 'AU',
    'England': 'GB',
    'New Zealand': 'NZ',
    'Pakistan': 'PK',
    'Sri Lanka': 'LK',
    'West Indies': 'WI',
    'Bangladesh': 'BD',
    'Afghanistan': 'AF',
    'Ireland': 'IE',
    'Zimbabwe': 'ZW',
    'Netherlands': 'NL',
    'Scotland': 'GB',
    'Namibia': 'NA',
    'Oman': 'OM',
    'Nepal': 'NP',
    'Italy': 'IT',
    'USA': 'US',
    'United States of America': 'US',
    'United States': 'US',
    'Canada': 'CA',
    'Uganda': 'UG',
    'Papua New Guinea': 'PG',
    'UAE': 'AE',
    'United Arab Emirates': 'AE',
  };

  const code = map[teamName];
  if (!code) return '';
  // CricAPI generic flag pattern
  return `https://cdorg.b-cdn.net/flags/generic/${code}.svg`;
};

export const getCountryCode = (teamName: string): string => {
  const map: Record<string, string> = {
    'South Africa': 'ZA',
    'India': 'IN',
    'Australia': 'AU',
    'England': 'GB-ENG',
    'New Zealand': 'NZ',
    'Pakistan': 'PK',
    'Sri Lanka': 'LK',
    'West Indies': 'UM', // Using UM (US Minor Outlying Islands) as a visual fallback for WI flag
    'Bangladesh': 'BD',
    'Afghanistan': 'AF',
    'Ireland': 'IE',
    'Zimbabwe': 'ZW',
    'Netherlands': 'NL',
    'Scotland': 'GB-SCT',
    'Namibia': 'NA',
    'Oman': 'OM',
    'Nepal': 'NP',
    'Italy': 'IT',
    'USA': 'US',
    'United States of America': 'US',
    'United States': 'US',
    'Canada': 'CA',
    'Uganda': 'UG',
    'Papua New Guinea': 'PG',
    'UAE': 'AE',
    'United Arab Emirates': 'AE',
  };

  return map[teamName] || '';
};

import { prisma } from '../config/database';

/**
 * Dynamically analyzes existing employee codes of a company,
 * detects the most frequent pattern/prefix and the highest sequence number,
 * and generates the next code in that series.
 */
export async function generateNextEmployeeCode(companyId: string, tx?: any): Promise<string> {
  const db = tx || prisma;

  // Retrieve all active employee codes for this company
  const employees = await db.employee.findMany({
    where: { companyId },
    select: { employeeCode: true }
  });

  if (employees.length === 0) {
    return 'Htech-001'; // Default starting code if no employees exist yet
  }

  // Parse prefixes and track counts, maximum values, and padding lengths
  const prefixCounts: { [key: string]: { maxNum: number; padLength: number; count: number } } = {};

  for (const emp of employees) {
    // Regex splits the code into string prefix and numeric suffix
    const match = emp.employeeCode.match(/^(.*?)([0-9]+)$/);
    if (match) {
      const prefix = match[1];
      const numStr = match[2];
      const num = parseInt(numStr, 10);

      if (!prefixCounts[prefix]) {
        prefixCounts[prefix] = { maxNum: 0, padLength: numStr.length, count: 0 };
      }
      prefixCounts[prefix].count += 1;
      if (num > prefixCounts[prefix].maxNum) {
        prefixCounts[prefix].maxNum = num;
        prefixCounts[prefix].padLength = numStr.length;
      }
    }
  }

  let bestPrefix = 'EMP-';
  let maxCount = 0;
  let bestMaxNum = 0;
  let bestPadLength = 3;
  let prefixFound = false;

  for (const prefix in prefixCounts) {
    const data = prefixCounts[prefix];
    if (data.count > maxCount) {
      maxCount = data.count;
      bestPrefix = prefix;
      bestMaxNum = data.maxNum;
      bestPadLength = data.padLength;
      prefixFound = true;
    } else if (data.count === maxCount && prefixFound) {
      // Tie breaker: prioritize the pattern with the lower max number
      // (likely sequential sequence series rather than a random timestamp)
      if (data.maxNum < bestMaxNum) {
        bestPrefix = prefix;
        bestMaxNum = data.maxNum;
        bestPadLength = data.padLength;
      }
    }
  }

  if (prefixFound && bestMaxNum >= 0) {
    const nextNum = bestMaxNum + 1;
    const nextNumStr = String(nextNum).padStart(bestPadLength, '0');
    return `${bestPrefix}${nextNumStr}`;
  }

  // Fallback to timestamp if pattern parsing fails
  return `EMP-${Date.now().toString().slice(-6)}`;
}

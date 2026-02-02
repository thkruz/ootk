/*
 * + Operational
 * - Nonoperational
 * P Partially Operational
 * Partially fulfilling primary mission or secondary mission(s)
 * B Backup/Standby
 * Previously operational satellite put into reserve status
 * S Spare
 * New satellite awaiting full activation
 * X Extended Mission
 * D Decayed
 * ? Unknown
 */

export enum PayloadStatus {
  OPERATIONAL = '+',
  NONOPERATIONAL = '-',
  PARTIALLY_OPERATIONAL = 'P',
  BACKUP_STANDBY = 'B',
  SPARE = 'S',
  EXTENDED_MISSION = 'X',
  DECAYED = 'D',
  UNKNOWN = '?'
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMotivoBloqueoTarjeta1787200000000 implements MigrationInterface {
  name = 'AddMotivoBloqueoTarjeta1787200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."tarjetas_motivobloqueo_enum" AS ENUM('CLIENTE', 'INTENTOS_FALLIDOS', 'ADMINISTRADOR')`,
    );
    await queryRunner.query(
      `ALTER TABLE "tarjetas" ADD "motivoBloqueo" "public"."tarjetas_motivobloqueo_enum"`,
    );
    await queryRunner.query(
      `UPDATE "tarjetas" SET "motivoBloqueo" = 'INTENTOS_FALLIDOS' WHERE "estado" = 'BLOQUEADA' AND "intentosFallidos" >= 3`,
    );
    await queryRunner.query(
      `UPDATE "tarjetas" SET "motivoBloqueo" = 'ADMINISTRADOR' WHERE "estado" = 'BLOQUEADA' AND "motivoBloqueo" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tarjetas" DROP COLUMN "motivoBloqueo"`);
    await queryRunner.query(`DROP TYPE "public"."tarjetas_motivobloqueo_enum"`);
  }
}

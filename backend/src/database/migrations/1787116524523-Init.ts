import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1787116524523 implements MigrationInterface {
    name = 'Init1787116524523'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."usuarios_rol_enum" AS ENUM('CLIENTE', 'ADMINISTRADOR')`);
        await queryRunner.query(`CREATE TABLE "usuarios" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nombreCompleto" character varying(150) NOT NULL, "correo" character varying(150) NOT NULL, "passwordHash" character varying NOT NULL, "rol" "public"."usuarios_rol_enum" NOT NULL, "creadoEn" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_63665765c1a778a770c9bd585d3" UNIQUE ("correo"), CONSTRAINT "PK_d7281c63c176e152e4c531594a8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "cuentas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "numeroCuenta" character varying(30) NOT NULL, "saldo" numeric(14,2) NOT NULL DEFAULT '0', "creadaEn" TIMESTAMP NOT NULL DEFAULT now(), "usuario_id" uuid, CONSTRAINT "UQ_e36e6a7b3f26dd31824753a231b" UNIQUE ("numeroCuenta"), CONSTRAINT "PK_1176afa6e483a49bee4ad8d543e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."tarjetas_estado_enum" AS ENUM('ACTIVA', 'BLOQUEADA', 'INACTIVA')`);
        await queryRunner.query(`CREATE TABLE "tarjetas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "numeroTarjeta" character varying(20) NOT NULL, "pinHash" character varying NOT NULL, "estado" "public"."tarjetas_estado_enum" NOT NULL DEFAULT 'ACTIVA', "intentosFallidos" integer NOT NULL DEFAULT '0', "emitidaEn" TIMESTAMP NOT NULL DEFAULT now(), "cuenta_id" uuid, CONSTRAINT "UQ_d6c2e435ee203e6f8812d9cf10d" UNIQUE ("numeroTarjeta"), CONSTRAINT "REL_5673fb6ddfcbfda3ba57e48b66" UNIQUE ("cuenta_id"), CONSTRAINT "PK_3022435c0444dc066ea4fe1ba8a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."registros_auditoria_canal_enum" AS ENUM('ATM', 'APP', 'WEB')`);
        await queryRunner.query(`CREATE TABLE "registros_auditoria" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "accion" character varying NOT NULL, "entidadAfectada" character varying, "entidadId" character varying, "canal" "public"."registros_auditoria_canal_enum" NOT NULL, "detalle" character varying, "fecha" TIMESTAMP NOT NULL DEFAULT now(), "usuario_id" uuid, CONSTRAINT "PK_52a47d9f5f33f509ae83e56a747" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "notificaciones" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "mensaje" character varying NOT NULL, "creadaEn" TIMESTAMP NOT NULL DEFAULT now(), "cuenta_id" uuid, CONSTRAINT "PK_a9d32a419ff58b53a38b5ef85d4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."transacciones_tipo_enum" AS ENUM('RETIRO', 'DEPOSITO', 'TRANSFERENCIA', 'PAGO_SERVICIO')`);
        await queryRunner.query(`CREATE TYPE "public"."transacciones_estado_enum" AS ENUM('EXITOSA', 'FALLIDA', 'PENDIENTE')`);
        await queryRunner.query(`CREATE TYPE "public"."transacciones_canal_enum" AS ENUM('ATM', 'APP', 'WEB')`);
        await queryRunner.query(`CREATE TABLE "transacciones" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tipo" "public"."transacciones_tipo_enum" NOT NULL, "monto" numeric(14,2) NOT NULL, "estado" "public"."transacciones_estado_enum" NOT NULL, "canal" "public"."transacciones_canal_enum" NOT NULL, "descripcion" character varying, "fecha" TIMESTAMP NOT NULL DEFAULT now(), "cuenta_origen_id" uuid, "cuenta_destino_id" uuid, CONSTRAINT "PK_0a2c5d8bfe49d3bbccff3f17e8c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "cuentas" ADD CONSTRAINT "FK_91d6a100707975ec9c4a7eecc66" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tarjetas" ADD CONSTRAINT "FK_5673fb6ddfcbfda3ba57e48b662" FOREIGN KEY ("cuenta_id") REFERENCES "cuentas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "registros_auditoria" ADD CONSTRAINT "FK_d6689562c5d3417485e11acb63e" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notificaciones" ADD CONSTRAINT "FK_f69aced9cb34904dd444cf36761" FOREIGN KEY ("cuenta_id") REFERENCES "cuentas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transacciones" ADD CONSTRAINT "FK_1e02b3dbc42ae037c683a4681d1" FOREIGN KEY ("cuenta_origen_id") REFERENCES "cuentas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transacciones" ADD CONSTRAINT "FK_aee3aad5cb305cec8e4fd080d26" FOREIGN KEY ("cuenta_destino_id") REFERENCES "cuentas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transacciones" DROP CONSTRAINT "FK_aee3aad5cb305cec8e4fd080d26"`);
        await queryRunner.query(`ALTER TABLE "transacciones" DROP CONSTRAINT "FK_1e02b3dbc42ae037c683a4681d1"`);
        await queryRunner.query(`ALTER TABLE "notificaciones" DROP CONSTRAINT "FK_f69aced9cb34904dd444cf36761"`);
        await queryRunner.query(`ALTER TABLE "registros_auditoria" DROP CONSTRAINT "FK_d6689562c5d3417485e11acb63e"`);
        await queryRunner.query(`ALTER TABLE "tarjetas" DROP CONSTRAINT "FK_5673fb6ddfcbfda3ba57e48b662"`);
        await queryRunner.query(`ALTER TABLE "cuentas" DROP CONSTRAINT "FK_91d6a100707975ec9c4a7eecc66"`);
        await queryRunner.query(`DROP TABLE "transacciones"`);
        await queryRunner.query(`DROP TYPE "public"."transacciones_canal_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transacciones_estado_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transacciones_tipo_enum"`);
        await queryRunner.query(`DROP TABLE "notificaciones"`);
        await queryRunner.query(`DROP TABLE "registros_auditoria"`);
        await queryRunner.query(`DROP TYPE "public"."registros_auditoria_canal_enum"`);
        await queryRunner.query(`DROP TABLE "tarjetas"`);
        await queryRunner.query(`DROP TYPE "public"."tarjetas_estado_enum"`);
        await queryRunner.query(`DROP TABLE "cuentas"`);
        await queryRunner.query(`DROP TABLE "usuarios"`);
        await queryRunner.query(`DROP TYPE "public"."usuarios_rol_enum"`);
    }

}

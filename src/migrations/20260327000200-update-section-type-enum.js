'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_sections_type" RENAME TO "enum_sections_type_old";
      CREATE TYPE "enum_sections_type" AS ENUM ('theory', 'exercise', 'test');
      ALTER TABLE sections ALTER COLUMN type TYPE "enum_sections_type" USING 
        CASE 
          WHEN type::text = 'exercises' THEN 'exercise'::enum_sections_type
          ELSE type::text::enum_sections_type
        END;
      DROP TYPE "enum_sections_type_old";
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_sections_type" RENAME TO "enum_sections_type_old";
      CREATE TYPE "enum_sections_type" AS ENUM ('theory', 'exercises', 'test');
      ALTER TABLE sections ALTER COLUMN type TYPE "enum_sections_type" USING 
        CASE 
          WHEN type::text = 'exercise' THEN 'exercises'::enum_sections_type
          ELSE type::text::enum_sections_type
        END;
      DROP TYPE "enum_sections_type_old";
    `);
  }
};
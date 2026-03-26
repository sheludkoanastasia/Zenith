'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Проверяем существование старого ENUM
        const enumExists = await queryInterface.sequelize.query(`
            SELECT EXISTS (
                SELECT 1 FROM pg_type WHERE typname = 'enum_sections_type'
            );
        `);
        
        if (enumExists[0][0].exists) {
            // Создаем новый ENUM
            await queryInterface.sequelize.query(`
                ALTER TYPE "enum_sections_type" RENAME TO "enum_sections_type_old";
                CREATE TYPE "enum_sections_type" AS ENUM ('theory', 'exercises', 'test');
                ALTER TABLE sections ALTER COLUMN type TYPE "enum_sections_type" USING 
                    CASE 
                        WHEN type::text = 'matching' THEN 'exercises'::enum_sections_type
                        WHEN type::text = 'fill_blanks' THEN 'test'::enum_sections_type
                        ELSE type::text::enum_sections_type
                    END;
                DROP TYPE "enum_sections_type_old";
            `);
        }
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.sequelize.query(`
            ALTER TYPE "enum_sections_type" RENAME TO "enum_sections_type_old";
            CREATE TYPE "enum_sections_type" AS ENUM ('theory', 'matching', 'fill_blanks');
            ALTER TABLE sections ALTER COLUMN type TYPE "enum_sections_type" USING 
                CASE 
                    WHEN type::text = 'exercises' THEN 'matching'::enum_sections_type
                    WHEN type::text = 'test' THEN 'fill_blanks'::enum_sections_type
                    ELSE type::text::enum_sections_type
                END;
            DROP TYPE "enum_sections_type_old";
        `);
    }
};
INSERT INTO "HolidayEvent" ("id", "name", "date", "description", "isVietnamese", "isActive", "createdAt")
SELECT
    seed."id",
    seed."name",
    seed."date",
    seed."description",
    seed."isVietnamese",
    TRUE,
    CURRENT_TIMESTAMP
FROM (
    VALUES
        ('holiday_valentine', 'Valentine', '02-14', 'Ngày lễ tình nhân', FALSE),
        ('holiday_womens_day', 'Quốc tế Phụ nữ', '03-08', 'Ngày 8/3 - dịp vàng cho spa', TRUE),
        ('holiday_reunification', 'Ngày Giải phóng miền Nam', '04-30', 'Ngày lễ 30/4', TRUE),
        ('holiday_labour', 'Quốc tế Lao động', '05-01', 'Ngày lễ 1/5', TRUE),
        ('holiday_family', 'Ngày gia đình Việt Nam', '06-28', 'Ngày gia đình Việt Nam 28/6', TRUE),
        ('holiday_national', 'Quốc khánh', '09-02', 'Quốc khánh Việt Nam 2/9', TRUE),
        ('holiday_vietnamese_women', 'Phụ nữ Việt Nam', '10-20', 'Ngày Phụ nữ Việt Nam 20/10', TRUE),
        ('holiday_halloween', 'Halloween', '10-31', 'Halloween', FALSE),
        ('holiday_christmas', 'Giáng sinh', '12-25', 'Giáng sinh', FALSE),
        ('holiday_year_end', 'Tất niên dương lịch', '12-31', 'Ngày cuối năm dương lịch', FALSE)
) AS seed("id", "name", "date", "description", "isVietnamese")
WHERE NOT EXISTS (
    SELECT 1
    FROM "HolidayEvent" existing
    WHERE existing."name" = seed."name"
      AND existing."date" = seed."date"
);

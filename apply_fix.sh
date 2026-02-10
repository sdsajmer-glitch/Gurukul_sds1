#!/bin/bash

# ==============================================================================
# QUICK FIX SCRIPT FOR ENROLLMENT STATUS ISSUE
# ==============================================================================
# This script applies the complete fix to your Supabase database
# Run this if you have PostgreSQL command-line access
# ==============================================================================

echo "🔧 Enrollment Status Fix - Starting..."
echo ""

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    echo "❌ ERROR: PostgreSQL client (psql) is not installed"
    echo "Please install it or run the SQL script manually in Supabase Dashboard"
    exit 1
fi

# Ask for database connection details
echo "📝 Please provide your database connection details:"
echo ""
read -p "Database Host (e.g., db.xxx.supabase.co): " DB_HOST
read -p "Database Name (usually 'postgres'): " DB_NAME
read -p "Database User (usually 'postgres'): " DB_USER
read -sp "Database Password: " DB_PASSWORD
echo ""
echo ""

# Construct connection string
DB_CONNECTION="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME}"

echo "🔌 Testing database connection..."
psql "${DB_CONNECTION}" -c "SELECT version();" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Connection successful!"
else
    echo "❌ Connection failed. Please check your credentials."
    exit 1
fi

echo ""
echo "🚀 Applying fix script..."
echo ""

# Run the SQL fix script
psql "${DB_CONNECTION}" -f "FIX_ENROLLMENT_STATUS_COMPLETE.sql"

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "✅ FIX APPLIED SUCCESSFULLY!"
    echo "=========================================="
    echo ""
    echo "Next steps:"
    echo "1. Refresh your web application"
    echo "2. Try changing a student's enrollment status"
    echo "3. Try assigning a student to a class"
    echo ""
    echo "If you encounter any issues:"
    echo "- Check browser console (F12) for errors"
    echo "- Review ENROLLMENT_FIX_README.md for troubleshooting"
    echo "- Run verification queries (see README)"
    echo ""
else
    echo ""
    echo "❌ Fix script failed. Please review errors above."
    echo "You can also run the SQL manually in Supabase Dashboard."
    echo ""
    exit 1
fi

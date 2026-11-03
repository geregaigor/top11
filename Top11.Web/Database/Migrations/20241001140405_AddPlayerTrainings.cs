using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Top11.Web.Database.Migrations
{
    /// <inheritdoc />
    public partial class AddPlayerTrainings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Trainings",
                table: "Players",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Trainings",
                table: "Players");
        }
    }
}

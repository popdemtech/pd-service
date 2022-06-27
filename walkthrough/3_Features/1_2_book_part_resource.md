## The Book Divison Resource

BookPart
- title
- slug
- content
- sectionType
- sequence
- parent_part
- book

### 1. Create the Data Model

1. Generate model
```
npx sequelize model:generate --name BookSection --attributes title:string,slug:string,content:text,sectionType:string,sequence:integer,bookId:integer
```

2. Customize generated files
Customize the generated model and migration files to refect the Book to Book Section one-to-many relatonship.
model file:

```javascript
const {
  Model
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class BookSection extends Model {
    static associate(models) {
      BookSection.belongsTo(models.Book, { foreignKey: 'bookId' });
    }
  }

  BookSection.init({
    title: DataTypes.STRING,
    slug: DataTypes.STRING,
    content: DataTypes.TEXT,
    sectionType: DataTypes.STRING,
    sequence: DataTypes.INTEGER,
    bookId: {
      type: DataTypes.INTEGER,
      references: {
        model: 'Books',
        key: 'id'
      }
    },
    parentSectionId: {
      type: DataTypes.INTEGER,
      references: {
        model: 'BookSections',
        key: 'id'
      }
    }
  }, {
    sequelize,
    modelName: 'BookSection',
  });

  return BookSection;
};
```

migration, changes to slug and bookId:
```javascript
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('BookSections', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      title: {
        type: Sequelize.STRING
      },
      slug: {
        type: Sequelize.STRING,
        allowNull: false
      },
      content: {
        type: Sequelize.TEXT
      },
      sectionType: {
        type: Sequelize.STRING
      },
      sequence: {
        type: Sequelize.INTEGER
      },
      bookId: {
        type: Sequelize.INTEGER,
        references: {
          model: {
            tableName: 'Books'
          },
          key: 'id'
        },
        allowNull: false
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('BookSections');
  }
};
```

```
$ npx sequelize db:migrate
```

### 3. Add Parent Section Reference
1. generate migration
```
$ npx sequelize migration:generate --name add-parent-book-section
```

2. Fill in migration
```javascript
module.exports = {
  async up (queryInterface, Sequelize) {
     return await queryInterface.addColumn('BookSections', 'parentSectionId', {
       type: Sequelize.INTEGER,
       references: {
          model: {
            tableName: 'BookSections'
          },
          key: 'id'
        }
     })
  },

  async down (queryInterface, Sequelize) {
     return queryInterface.removeColumn('BookSections', 'parentSectionId');
  }
};
```

3. Run migration
```
$ npx sequelize db:migrate
```

4. Modify the Model

Modify the associate function
```javascript
static associate(models) {
  BookSection.belongsTo(models.Book, { foreignKey: 'bookId' });
  BookSection.hasOne(models.BookSection, {
    foreignKey: 'parentSectionId'
  });
  BookSection.hasMany(models.BookSection, {
    foreignKey: 'parentSectionId'
  });
}
```

Modify the data model definition
```javascript
BookSection.init({
  title: DataTypes.STRING,
  slug: DataTypes.STRING,
  content: DataTypes.TEXT,
  sectionType: DataTypes.STRING,
  sequence: DataTypes.INTEGER,
  bookId: {
    type: DataTypes.INTEGER,
    references: {
      model: 'Books',
      key: 'id'
    }
  },
  parentSectionId: {
    type: DataTypes.INTEGER,
    references: {
      model: 'BookSections',
      key: 'id'
    }
  }
}, {
  sequelize,
  modelName: 'BookSection',
});
```

### 2. Seed Book Sections
```
$ npx sequelize seed:generate --name first-book-sections
```

The contents of the seed files depend on the structure of the book data you are importing. The general steps to importing the book data is

1. Add the data files to the repository.

2. Import the data file into the seed file.

3. Transform the data contained in the file to the `BookSection` data model.

4. Save the transformed data to the database.

Fill in the `down` function of the migration file with code that will undo whatever database changes are caused by the `up` function.


### 2. List Book Sections
On the book show page, let's list all sections contained within the book. The sections should be displayed in a nested structure such that sections are rendered in an ordered list underneath their respective `parentSection`.

1. Modify the data retrival for the book show route to also get all of its book sections.

```javascript
app.get('/books/:slug', async function(request, response, next) {
  const book = await Book.findOne({
    where: { slug: request.params.slug },
    include: BookSection
  });
  if (book == null) {
    response.status(404);
    next();
    return;
  }
  
  const bookTree = BookSection.toTree(book.BookSections);

  response.render('books/show', { book, bookTree });
});
```

2. Add a `toTree` method which converts the flat data structure returned by the database call to a nested structure of parent-child relationships. We will add this method as a class method on `BookSection`.

```javascript
static toTree(bookSections) {
  const byParentSection = groupBy(bookSections, 'parentSectionId');
  const getChildren = (sectionId) => {
    const children = byParentSection[sectionId];
    if (!children) return;

    for (let i = 0; i < children.length; i++) {
      let child = children[i];
      let grandChildren = getChildren(child.id);
      child['childSections'] = grandChildren;
    }

    return children;
  };

  const root = byParentSection[null];
  root.forEach((section) => {
    section['childSections'] = getChildren(section.id);
  });

  return root;
}
```

3. Render the book tree in the view layer

In the book show view, render the root book sections.
```html
<div class="book-sections">
  {% for section in bookTree %}
    <div class="book-section-panel" style="margin-bottom: 20px;">
      {% render 'books/book-section.liquid', section: section %}
    </div>
  {% endfor %}
</div>
```

Create the `book-section.liquid` partial.
```html
<h2>{{ section.title }}</h2>

{% if section.childSections %}
  <div class="child-section-list">
  {% for childSection in section.childSections %}
  <p class="book-section-list-item section-title">{{ childSection.title }}</p>
  {% endfor %}
  </div>
{% endif %}
```

### 3. 

### Resources
Associations in the model definition: https://sequelize.org/docs/v6/core-concepts/model-basics/#column-declaration-shorthand-syntax

Sequelize migrations: https://sequelize.org/docs/v6/other-topics/migrations/#creating-the-first-seed